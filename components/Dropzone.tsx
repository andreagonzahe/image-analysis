"use client";

import { useCallback, useRef, useState } from "react";
import { isAcceptedFile, MAX_DIM } from "@/lib/image-prep";

type Props = {
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
};

export function Dropzone({ onFiles, onError }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(isAcceptedFile);
      if (accepted.length === 0) {
        onError?.("No image or video files found in your selection.");
        return;
      }
      const rejected = files.length - accepted.length;
      if (rejected > 0) {
        onError?.(`Skipped ${rejected} unsupported file${rejected === 1 ? "" : "s"}.`);
      }
      onFiles(accepted);
    },
    [onFiles, onError]
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
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <div className="drop-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div className="drop-main">Drop image(s) or video(s) here, or click to choose</div>
      <div className="drop-hint">Images: JPEG · PNG · WebP · HEIC. Videos: MP4 · MOV · WebM, up to 15 min</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.heic,.heif,.mp4,.mov,.webm,.m4v"
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

export { MAX_DIM };
