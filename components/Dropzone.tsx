"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onImages: (dataUrls: string[]) => void;
  onError?: (message: string) => void;
};

const MAX_DIM = 2048;

export function Dropzone({ onImages, onError }: Props) {
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const accepted = files.filter((f) => {
        const isHeic = /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);
        return f.type.startsWith("image/") || isHeic;
      });
      if (accepted.length === 0) {
        onError?.("No image files found in your selection.");
        return;
      }
      const rejected = files.length - accepted.length;
      if (rejected > 0) {
        onError?.(`Skipped ${rejected} non-image file${rejected === 1 ? "" : "s"}.`);
      }

      setWorking(true);
      setProgress({ done: 0, total: accepted.length });
      const out: string[] = [];
      try {
        for (let i = 0; i < accepted.length; i++) {
          const file = accepted[i];
          const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
          try {
            const normalized = isHeic ? await heicToJpeg(file) : file;
            const dataUrl = await resizeImage(normalized);
            out.push(dataUrl);
          } catch (err) {
            console.error(`Skipping ${file.name}:`, err);
          }
          setProgress({ done: i + 1, total: accepted.length });
        }
        if (out.length === 0) {
          onError?.("None of the selected files could be decoded.");
        } else {
          onImages(out);
        }
      } finally {
        setWorking(false);
        setProgress(null);
      }
    },
    [onImages, onError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) handleFiles(files);
    },
    [handleFiles]
  );

  return (
    <div
      className={`dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !working && inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <div className="drop-icon" aria-hidden>
        {working ? (
          <span className="spinner" style={{ borderTopColor: "white" }} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <div className="drop-main">
        {working
          ? progress
            ? `Reading images… ${progress.done} of ${progress.total}`
            : "Reading your image…"
          : "Drop image(s) here, or click to choose"}
      </div>
      <div className="drop-hint">JPEG · PNG · WebP · HEIC — drop one or many; batch up to 50</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

async function resizeImage(file: File | Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) {
      throw new Error("Could not read image dimensions. The file may be corrupted.");
    }
    const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));
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

async function heicToJpeg(file: File): Promise<Blob> {
  const { heicTo, isHeic } = await import("heic-to");
  const looksHeic = await isHeic(file).catch(() => true);
  if (!looksHeic) {
    return file;
  }
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
}
