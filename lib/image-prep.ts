// Browser-side image preparation: HEIC -> JPEG conversion and resize to a max
// dimension. Used by both the single-file preview flow and the batch queue.

export const MAX_DIM = 2048;

export function isHeic(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

export async function prepImage(file: File, maxDim: number = MAX_DIM): Promise<string> {
  const normalized = isHeic(file) ? await heicToJpegBlob(file) : file;
  return resizeToDataUrl(normalized, maxDim);
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
