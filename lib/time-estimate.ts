// Shared time + cost estimation for the 3-pass import pipeline.
//
// Single source of truth for /import (pre-import forecast) and
// /import/status (live ETA fallback). If either drifts from reality,
// fix it HERE — the consumers don't define their own numbers.
//
// The pipeline:
//   1. screen        free, server-side. Drops blurry, duplicate
//                    (cross-batch + same-batch), and obvious
//                    text/UI screenshot images.
//   2. prefilter     ~$0.001/img. Qwen-VL keep/skip on non-human,
//                    screenshot, group-photo, etc.
//   3. analyze_image ~$0.005-0.010/img. Full NSFW + captioner +
//                    Together strategist. Belt-and-suspenders drops
//                    captioner-confirmed animal photos before paying
//                    Together.
//
// Empirical survival rates measured against a 2000-photo mixed roll
// after the screen + prefilter tightening (text-uniformity, cross-batch
// dedup at Hamming ≤ 12, animal subject rejection):
//
//   screen survival   : ~55%   (45% drop: blur, dedup, text/UI)
//   prefilter survival: ~45%   (of screen survivors)
//   captioner gate    : ~95%   (a small fraction skip in analyze)
//
//   Compound survival to vault: 0.55 × 0.45 × 0.95 ≈ 23%

export const SCREEN_SURVIVAL = 0.55;
export const PREFILTER_SURVIVAL = 0.45;
export const ANALYZE_KEEP_AFTER_BELT = 0.95;

/** Fraction of input images that end up as a vault post. */
export const KEEPER_RATIO =
  SCREEN_SURVIVAL * PREFILTER_SURVIVAL * ANALYZE_KEEP_AFTER_BELT;

// Costs per image at each paid stage (USD, billed on the user's own
// Replicate / Together accounts).
export const PREFILTER_COST_PER_IMAGE = 0.001;
export const ANALYZE_COST_PER_IMAGE = 0.005;

// Per-job wall-clock budgets, measured empirically against the
// Replicate/Together steady-state rates. These are the numbers each
// individual job needs end-to-end (fetch + AI call + DB write).
//   * screen:     thumbnail fetch + sharp fingerprint + cross-batch
//                 dedup query. Bounded by Dropbox API latency.
//   * prefilter:  Qwen-VL on Replicate with 30-token output cap.
//                 Dominated by Replicate cold-start + inference.
//   * analyze:    NSFW + captioner run parallel on Replicate, then
//                 Together strategist. Captioner is the slowest leg.
const PER_JOB_WALL_SECS = {
  screen: 1.5,
  prefilter: 4.0,
  analyze: 11.0,
} as const;

// How many jobs the worker processes per cron tick. Mirrors the
// JOBS_PER_TICK constant in app/api/cron/process-jobs/route.ts.
const JOBS_PER_TICK = 8;

/**
 * Estimate total wall-clock for a fresh import of `count` source images,
 * accounting for the 3-pass pipeline and the configured parallelism.
 *
 * Returns two numbers — fast / slow — so the UI can present a range
 * that captures the real-world variance between:
 *   * Fast: status tab stays open, the BatchChecker chain-fires the
 *     worker as soon as each tick resolves. Throughput is limited by
 *     analyze stage parallelism (8 in flight × ~11s = ~0.73 analyze/s).
 *   * Slow: tab closed, only Vercel cron drives the queue at 1/min.
 *     Throughput drops to JOBS_PER_TICK per minute, regardless of how
 *     fast individual jobs are. Catastrophically slower for big imports.
 */
export function estimateImportSeconds(count: number): {
  fastSec: number;
  slowSec: number;
} {
  if (count <= 0) return { fastSec: 0, slowSec: 0 };

  // Expected number of jobs of each kind given the funnel.
  const screenJobs = count;
  const prefilterJobs = Math.round(count * SCREEN_SURVIVAL);
  const analyzeJobs = Math.round(count * SCREEN_SURVIVAL * PREFILTER_SURVIVAL);

  // FAST: chain-fire. Each kind drains at (parallelism / per-job-secs).
  // Stages overlap once the pipeline is primed, so total ≈ time to
  // drain analyze + the initial fill time (≈ one full pipeline pass).
  const fastSec =
    (analyzeJobs * PER_JOB_WALL_SECS.analyze) / JOBS_PER_TICK +
    (prefilterJobs * PER_JOB_WALL_SECS.prefilter) / JOBS_PER_TICK * 0.4 +
    (screenJobs * PER_JOB_WALL_SECS.screen) / JOBS_PER_TICK * 0.3;

  // SLOW: cron-only. JOBS_PER_TICK jobs per minute, regardless of kind.
  const totalJobs = screenJobs + prefilterJobs + analyzeJobs;
  const slowSec = (totalJobs / JOBS_PER_TICK) * 60;

  return { fastSec, slowSec };
}

/**
 * Estimate remaining wall-clock from a live status snapshot. Uses the
 * per-kind remaining counts so the prediction stays sensible even when
 * the pipeline is mid-drain (i.e. mostly analyze jobs remaining).
 */
export function estimateRemainingSeconds(remaining: {
  screen: number;
  prefilter: number;
  analyze: number;
}): { fastSec: number; slowSec: number } {
  const fastSec =
    (remaining.analyze * PER_JOB_WALL_SECS.analyze) / JOBS_PER_TICK +
    (remaining.prefilter * PER_JOB_WALL_SECS.prefilter) / JOBS_PER_TICK +
    (remaining.screen * PER_JOB_WALL_SECS.screen) / JOBS_PER_TICK;
  const totalJobs = remaining.screen + remaining.prefilter + remaining.analyze;
  const slowSec = (totalJobs / JOBS_PER_TICK) * 60;
  return { fastSec, slowSec };
}

/** Pretty-print a duration in seconds for the UI. */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "almost done";
  if (seconds < 60) return `~${Math.round(seconds)} sec`;
  const min = seconds / 60;
  if (min < 2) return "~1 min";
  if (min < 60) return `~${Math.round(min)} min`;
  const hr = min / 60;
  if (hr < 10) return `~${(Math.round(hr * 10) / 10).toFixed(1)} hr`;
  return `~${Math.round(hr)} hr`;
}

/** Format a fast/slow range pair for display. */
export function formatDurationRange(fastSec: number, slowSec: number): string {
  if (fastSec <= 0 && slowSec <= 0) return "< 1 min";
  if (slowSec < fastSec * 1.4) {
    // Range is tight enough that one number reads better.
    return formatDuration((fastSec + slowSec) / 2);
  }
  return `${formatDuration(fastSec)}–${formatDuration(slowSec)}`;
}
