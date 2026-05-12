// Browser-side image / video preparation. For images: HEIC -> JPEG conversion
// and resize. For videos: extract 4 evenly-spaced frames, tile into a single
// JPEG montage. The downstream tagger handles the montage like any other image.

export const MAX_DIM = 2048;
export const VIDEO_MAX_DURATION_SECONDS = 15 * 60; // 15 minutes
export const VIDEO_FRAME_COUNT = 9;                 // 3x3 grid (was 4 in 2x2)
export const VIDEO_GRID_COLS = 3;

export function isHeic(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

export function isAcceptedFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file);
}

export async function prepImage(file: File, maxDim: number = MAX_DIM): Promise<string> {
  if (isVideoFile(file)) {
    return prepVideo(file, maxDim);
  }
  const normalized = isHeic(file) ? await heicToJpegBlob(file) : file;
  return resizeToDataUrl(normalized, maxDim);
}

async function prepVideo(file: File, maxDim: number): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  let video: HTMLVideoElement | null = null;
  try {
    video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video!.onloadedmetadata = () => resolve();
      video!.onerror = () => reject(new Error("Could not decode video file."));
    });

    const duration = video.duration || 0;
    if (!duration || !isFinite(duration)) {
      throw new Error("Could not read video duration.");
    }
    if (duration > VIDEO_MAX_DURATION_SECONDS) {
      throw new Error(`Video is too long (${Math.round(duration)}s). Maximum is ${VIDEO_MAX_DURATION_SECONDS / 60} minutes.`);
    }

    // Pick 9 timestamps: 2 near the start (hook frames matter for TikTok-style
    // content), 5 evenly spread through the middle, 2 near the end (payoff).
    // For very short videos, evenly-spaced still works.
    const frameTimes: number[] = (() => {
      if (duration < 8) {
        return Array.from({ length: VIDEO_FRAME_COUNT }, (_, i) => duration * (i + 0.5) / VIDEO_FRAME_COUNT);
      }
      const startPair = [0.02, 0.08].map((f) => duration * f);
      const endPair = [0.92, 0.98].map((f) => duration * f);
      const middleCount = VIDEO_FRAME_COUNT - 4;
      const middle = Array.from(
        { length: middleCount },
        (_, i) => duration * (0.15 + (0.70 * (i + 0.5) / middleCount))
      );
      return [...startPair, ...middle, ...endPair];
    })();

    const frames: HTMLCanvasElement[] = [];
    for (const t of frameTimes) {
      frames.push(await captureFrame(video, t));
    }

    return tileFramesAsDataUrl(frames, maxDim);
  } finally {
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
    URL.revokeObjectURL(objectUrl);
  }
}

async function captureFrame(video: HTMLVideoElement, time: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.max(0, Math.min(time, video.duration - 0.01));
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Frame capture timed out"));
    }, 8000);
  });
}

function tileFramesAsDataUrl(frames: HTMLCanvasElement[], maxDim: number): string {
  if (frames.length === 0) throw new Error("No frames to tile");
  const cols = VIDEO_GRID_COLS;
  const rows = Math.ceil(frames.length / cols);
  // Each tile gets up to (maxDim / cols) on its longest side, so a 3x3 grid
  // at 2048 output dim gives ~683px tiles — still plenty of detail for tagging.
  const tileMaxDim = Math.floor(maxDim / cols);

  // Scale each frame to fit tileMaxDim while preserving aspect ratio.
  const tiles = frames.map((c) => {
    const scale = Math.min(1, tileMaxDim / Math.max(c.width, c.height));
    const w = Math.round(c.width * scale);
    const h = Math.round(c.height * scale);
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const tx = t.getContext("2d");
    if (!tx) throw new Error("Canvas not available");
    tx.drawImage(c, 0, 0, w, h);
    return t;
  });

  // Use the largest tile size to set the grid cell size uniformly.
  const cellW = Math.max(...tiles.map((t) => t.width));
  const cellH = Math.max(...tiles.map((t) => t.height));
  const finalW = cellW * cols;
  const finalH = cellH * rows;

  const out = document.createElement("canvas");
  out.width = finalW;
  out.height = finalH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, finalW, finalH);

  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center each tile in its cell.
    const dx = col * cellW + Math.floor((cellW - t.width) / 2);
    const dy = row * cellH + Math.floor((cellH - t.height) / 2);
    ctx.drawImage(t, dx, dy);
  });

  return out.toDataURL("image/jpeg", 0.88);
}

async function heicToJpegBlob(file: File): Promise<Blob> {
  const mod = await import("heic-to");
  const looksHeic = await mod.isHeic(file).catch(() => true);
  if (!looksHeic) return file;
  return mod.heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
}

async function resizeToDataUrl(file: File | Blob, maxDim: number): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) {
      throw new Error("Could not read image dimensions.");
    }
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded."));
    img.src = src;
  });
}
