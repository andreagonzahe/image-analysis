// Pure-JS pHash helpers. Safe to import from client code — no sharp /
// node dependencies. The full fingerprint pipeline lives in
// lib/image-fingerprint.ts and is server-only because sharp is.
//
// Split out so the vault page can do client-side shoot clustering
// (Hamming-distance-based grouping of visually similar posts) without
// pulling sharp into the browser bundle.

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x !== 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function phashFromString(s: string): bigint {
  return BigInt("0x" + s);
}

export function phashToString(h: bigint): string {
  return h.toString(16).padStart(16, "0");
}

// Hamming distance thresholds for different "same-ness" bands. The
// custom 2-bit-per-row dHash we use produces:
//   0–4   exact / near-exact reupload
//   5–14  burst shot, tiny pose drift   ← HAMMING_DUP (dedup)
//   15–22 same pose, retake             ← still dedup
//   23–32 same shoot, different pose    ← HAMMING_SHOOT (cluster)
//   33+   unrelated
export const HAMMING_DUP_THRESHOLD = 12;
export const HAMMING_SHOOT_THRESHOLD = 28;
