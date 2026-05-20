// Cheap server-side image fingerprinting used by the "screen" job to
// dedup near-identical shots and skip blurry/dark images BEFORE the
// expensive Qwen-VL prefilter + analysis steps run.
//
// Two cheap, deterministic metrics, both computed from a small grayscale
// version of the image (we downscale to 32×32 for hash, 64×64 for blur):
//
//   pHash  — 64-bit perceptual hash. Each bit encodes "is this pixel
//            brighter than the row average?" Near-identical images get
//            near-identical hashes. Compare with Hamming distance.
//
//   blur   — Laplacian variance. Convolve a 3×3 Laplacian kernel over
//            the 64×64 grayscale, compute variance of the response. High
//            variance = sharp edges = sharp image. Low variance = blur.
//            This is the same heuristic OpenCV's "is_blurry" docs cite.

import sharp from "sharp";

export type Fingerprint = {
  phash: bigint; // 64-bit; serialize as string when going through JSON
  blur_score: number; // Laplacian variance — empirical scale ~0..1000+
  text_score: number; // 0..1 — flat-color uniformity, high = screenshot-like
  width: number;
  height: number;
  byte_size: number;
};

// Thresholds.
//
//   BLUR_THRESHOLD_LOOSE — Laplacian variance below this = blurry,
//                          gets dropped before any paid call.
//
//   HAMMING_THRESHOLD    — bits-different cutoff for "this is the same
//                          shot as one we already kept." Calibrated to
//                          catch "1 per pose" — i.e. burst-shot
//                          variants, slight angle/lighting shifts of
//                          the same composition all collapse to one
//                          keeper. With the 2-bit-per-row dHash we
//                          use, real-world bit-distance bands are:
//                            0–4   exact / near-exact reupload
//                            5–10  burst shot, tiny pose drift
//                            11–14 same pose, retake — STILL DEDUP
//                            15–22 same scene, different angle
//                            23+   unrelated
//                          12 = aggressive enough to collapse retakes
//                          without merging genuinely different angles.
export const BLUR_THRESHOLD_LOOSE = 25;
export const HAMMING_THRESHOLD = 12;

// Screenshot heuristic. A screenshot has huge flat-color regions
// (chat background, app surface, web page body) — usually 60-80% of
// the pixels collapse into a single 16-level luminance bucket. Real
// photos very rarely cross 45% because even a clean studio backdrop
// has lighting gradients that spread pixels across multiple buckets.
//
// Setting the threshold at 0.55 to stay safely above the false-positive
// zone for high-key creator photos (white wall studio shots). Anything
// flagged here gets skipped FOR FREE — no Qwen-VL prefilter call, no
// captioner, no strategist. The downstream prefilter catches the
// borderline cases this misses.
export const TEXT_SCORE_THRESHOLD = 0.55;

/**
 * Compute pHash + blur score from raw image bytes. Returns null on
 * unrecognized formats so a bad file degrades to "we don't know" instead
 * of crashing the screen pass.
 */
export async function computeFingerprint(bytes: Buffer): Promise<Fingerprint | null> {
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return null;

    // Compute pHash from 32×32 grayscale.
    const hashRaster = await sharp(bytes)
      .grayscale()
      .resize(32, 32, { fit: "fill", kernel: "lanczos3" })
      .raw()
      .toBuffer();
    const phash = computePHash(hashRaster, 32);

    // Compute blur + text-likelihood scores from the same 64×64
    // grayscale buffer (one sharp call instead of two).
    const blurRaster = await sharp(bytes)
      .grayscale()
      .resize(64, 64, { fit: "fill", kernel: "lanczos3" })
      .raw()
      .toBuffer();
    const blur_score = computeLaplacianVariance(blurRaster, 64, 64);
    const text_score = computeTextScore(blurRaster);

    return {
      phash,
      blur_score,
      text_score,
      width: meta.width,
      height: meta.height,
      byte_size: bytes.byteLength,
    };
  } catch {
    return null;
  }
}

/**
 * Simplified dHash variant: for each row of the 32x32 grayscale, compute
 * 2 bits per row that capture relative brightness across 4-column
 * quadrants. 32 rows × 2 bits = 64 bits total. Robust to small crops,
 * resaves, brightness shifts — what we want for dedup.
 */
function computePHash(raw: Buffer, dim: number): bigint {
  let hash = 0n;
  for (let row = 0; row < dim; row++) {
    // Average each quarter of this row.
    const offset = row * dim;
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    const quarter = dim / 4;
    for (let c = 0; c < quarter; c++) {
      q1 += raw[offset + c];
      q2 += raw[offset + quarter + c];
      q3 += raw[offset + 2 * quarter + c];
      q4 += raw[offset + 3 * quarter + c];
    }
    // 2 bits per row: which half is brighter, and within the brighter
    // half which quarter is brighter. Captures coarse left/right
    // composition that's stable across slight pose variations.
    const leftHalf = q1 + q2;
    const rightHalf = q3 + q4;
    const bit1 = leftHalf > rightHalf ? 1n : 0n;
    const innerBrighter = bit1 ? (q2 > q1 ? 1n : 0n) : (q3 > q4 ? 1n : 0n);
    hash = (hash << 2n) | (bit1 << 1n) | innerBrighter;
  }
  return hash;
}

/**
 * Laplacian variance — proxy for image sharpness. We apply a 3×3
 * discrete Laplacian kernel:
 *   0  1  0
 *   1 -4  1
 *   0  1  0
 * to each pixel of a 64×64 grayscale and compute the variance of the
 * resulting values. Sharp edges produce large positive/negative responses;
 * a blurry image has small responses everywhere → low variance.
 */
function computeLaplacianVariance(raw: Buffer, w: number, h: number): number {
  const values: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        raw[i - w] + raw[i - 1] + raw[i + 1] + raw[i + w] - 4 * raw[i];
      values.push(lap);
    }
  }
  const n = values.length;
  if (n === 0) return 0;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let variance = 0;
  for (const v of values) variance += (v - mean) * (v - mean);
  return variance / n;
}

/**
 * Text-likelihood score in [0, 1]. Measures the fraction of pixels in
 * the most-common 16-level luminance bucket — i.e. how "flat-color"
 * the image is. Computed from the same 64×64 grayscale used for blur,
 * so it's effectively free.
 *
 * Why this works as a text/screenshot signal:
 *   * Chat / app / web screenshots have huge contiguous regions at one
 *     UI background color → 60-80% of pixels share one bucket.
 *   * Documents / receipts / spreadsheets are mostly white background
 *     with sparse dark text → 70%+ in the top bucket.
 *   * Real photos almost never exceed ~45% even when shot against a
 *     plain backdrop, because natural lighting creates gradient bands
 *     that spread pixels across multiple buckets.
 *
 * Pairs well with TEXT_SCORE_THRESHOLD = 0.55: catches the clear
 * cases (chats, documents, web) and leaves the prefilter to handle
 * ambiguous ones (mixed photo + text overlays, app screenshots with
 * lots of imagery).
 */
function computeTextScore(grayRaw: Buffer): number {
  const buckets = new Array(16).fill(0);
  for (let i = 0; i < grayRaw.length; i++) {
    buckets[grayRaw[i] >> 4]++; // luminance / 16 → bucket index
  }
  let max = 0;
  for (const b of buckets) if (b > max) max = b;
  return max / grayRaw.length;
}

/**
 * Hamming distance between two 64-bit pHash values. Result is in 0..64.
 * Smaller = more similar. <=8 is our default "near-duplicate" threshold.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x !== 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/**
 * Serialization helpers — bigint doesn't survive JSON natively, so we
 * cast to string when storing on a job and parse back when comparing.
 */
export function phashToString(h: bigint): string {
  return h.toString(16).padStart(16, "0");
}
export function phashFromString(s: string): bigint {
  return BigInt("0x" + s);
}
