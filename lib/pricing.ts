/**
 * Cost rates for the paid APIs we call. Keep this file as the single source
 * of truth — the billing dashboard reads from here too.
 *
 * Rates as of 2025. Update when providers change pricing.
 */

// ----- Replicate -----
// Replicate bills per second of GPU runtime. Rate depends on the hardware
// the model runs on. We tag each model with the hardware tier we know it
// uses; if we can't determine the hardware, default to A40 (mid-range).
//
// Reference: https://replicate.com/pricing
export const REPLICATE_HARDWARE_RATE_PER_SEC: Record<string, number> = {
  CPU: 0.0001,
  T4: 0.000225,
  A40: 0.000725,
  L40S: 0.000975,
  A100_40GB: 0.001150,
  A100_80GB: 0.001400,
  H100: 0.001528,
};

// Best-known hardware mapping per model identifier (or model prefix).
// Replicate's NSFW classifier runs on cheap hardware (T4).
// Qwen2-VL / similar vision-language models run on A100.
export const REPLICATE_MODEL_HARDWARE: Record<string, keyof typeof REPLICATE_HARDWARE_RATE_PER_SEC> = {
  "falcons-ai/nsfw_image_detection": "T4",
  // Qwen2-VL family — A100 80GB
  "lucataco/qwen2-vl-7b-instruct": "A100_80GB",
  "lucataco/qwen2-vl-72b": "A100_80GB",
  // Fallback handled in costFor* below
};

function hardwareForReplicateModel(model: string): keyof typeof REPLICATE_HARDWARE_RATE_PER_SEC {
  // Exact match first, then prefix match.
  if (REPLICATE_MODEL_HARDWARE[model]) return REPLICATE_MODEL_HARDWARE[model];
  for (const key of Object.keys(REPLICATE_MODEL_HARDWARE)) {
    if (model.startsWith(key)) return REPLICATE_MODEL_HARDWARE[key];
  }
  return "A40"; // conservative middle ground
}

export function costForReplicateRuntime(model: string, predictTimeSec: number): number {
  const hw = hardwareForReplicateModel(model);
  const rate = REPLICATE_HARDWARE_RATE_PER_SEC[hw];
  return Math.max(0, predictTimeSec) * rate;
}

// ----- Together AI -----
// Together publishes per-1M-token pricing per model.
// Reference: https://www.together.ai/pricing
// Numbers below are in USD per token (per-1M divided by 1,000,000).
type TokenRate = { input_per_token: number; output_per_token: number };

export const TOGETHER_MODEL_RATES: Record<string, TokenRate> = {
  // Llama 3.3 70B Instruct Turbo: $0.88 per 1M tokens (in + out same)
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    input_per_token: 0.88e-6,
    output_per_token: 0.88e-6,
  },
  // Llama 3.1 70B Turbo same rate
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
    input_per_token: 0.88e-6,
    output_per_token: 0.88e-6,
  },
  // Llama 3.1 8B Turbo
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
    input_per_token: 0.18e-6,
    output_per_token: 0.18e-6,
  },
};

export function costForTogetherCall(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = TOGETHER_MODEL_RATES[model] ?? {
    input_per_token: 1e-6, // conservative fallback for unknown model
    output_per_token: 1e-6,
  };
  return (
    rate.input_per_token * Math.max(0, promptTokens) +
    rate.output_per_token * Math.max(0, completionTokens)
  );
}

// Pretty-print a USD cost. Tiny values get extra decimals; bigger values get
// trimmed.
export function formatUsd(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}
