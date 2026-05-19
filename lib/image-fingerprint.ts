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
  width: number;
  height: number;
  byte_size: number;
};

// Thresholds set deliberately loose per the user's spec (5-10% drop
// rate). Tune by adjusting these constants — no callsite changes needed.
export const BLUR_THRESHOLD_LOOSE = 25; // anything under is considered blurry
export const HAMMING_THRESHOLD = 8; // 8/64 bits = near-duplicate

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

    // Compute blur score from 64×64 grayscale.
    const blurRaster = await sharp(bytes)
      .grayscale()
      .resize(64, 64, { fit: "fill", kernel: "lanczos3" })
      .raw()
      .toBuffer();
    const blur_score = computeLaplacianVariance(blurRaster, 64, 64);

    return {
      phash,
      blur_score,
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
