// Server-side image prep for the bulk-import worker.
//
// Replicate's vision models use a Python PIL build that can't decode HEIC /
// HEIF — the format Apple Photos uses by default. iPhone-sourced libraries
// would otherwise fail every job with "cannot identify image file '/tmp/...'".
//
// We download HEIC files from Dropbox, convert to JPEG with libheif (via the
// pure-JS heic-convert package), and pass Replicate a base-64 data URL.
// Other formats pass through unchanged.

import heicConvert from "heic-convert";

// Conservative cap so a runaway HEIC (some are 30+ MB) doesn't blow memory or
// time-out the cron tick.
const MAX_HEIC_BYTES = 25 * 1024 * 1024;

// Quality knob for the JPEG we hand to Replicate. 0.85 is the sweet spot for
// classifier/captioner accuracy — lower starts to lose fine detail, higher
// just grows bytes for no model benefit.
const JPEG_QUALITY = 0.85;

const HEIC_NAME_RE = /\.(heic|heif)$/i;

export function isHeic(name: string | null | undefined): boolean {
  return Boolean(name && HEIC_NAME_RE.test(name));
}

/**
 * If `name` is HEIC/HEIF, fetch the bytes from `url`, convert to JPEG, and
 * return a `data:image/jpeg;base64,...` string. Otherwise return the URL
 * unchanged so the caller passes it straight through to Replicate.
 *
 * Throws on download failure or oversize file.
 */
export async function prepImageForReplicate(
  url: string,
  name: string | null | undefined
): Promise<string> {
  if (!isHeic(name)) return url;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch HEIC source (${res.status}): ${url.slice(0, 80)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_HEIC_BYTES) {
    throw new Error(
      `HEIC source too large (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB > ${MAX_HEIC_BYTES / 1024 / 1024} MB cap). Skipping.`
    );
  }

  // heic-convert's types want ArrayBufferLike; Node Buffer extends Uint8Array
  // so the underlying .buffer is what matters at runtime. Cast to keep
  // typing strict elsewhere.
  const jpegBuf = await heicConvert({
    buffer: buf as unknown as ArrayBufferLike,
    format: "JPEG",
    quality: JPEG_QUALITY,
  });

  const b64 = Buffer.from(jpegBuf).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}
