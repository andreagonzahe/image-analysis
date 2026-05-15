import { recordUsage } from "./usage";
import { costForReplicateRuntime } from "./pricing";

const REPLICATE_API = "https://api.replicate.com/v1";
const MODEL_SLUG = "falcons-ai/nsfw_image_detection";

export type NsfwVerdict = {
  verdict: "nsfw" | "normal";
  raw: string;
};

export async function classifyNsfw(imageDataUrl: string, userId?: string | null): Promise<NsfwVerdict> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");

  const version = await getLatestVersion(token);

  const wallStart = Date.now();
  const res = await postWithBackoff(
    `${REPLICATE_API}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        version,
        input: { image: imageDataUrl },
      }),
    },
    "NSFW classifier"
  );

  let prediction = await res.json();
  while (prediction.status === "starting" || prediction.status === "processing") {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await poll.json();
  }
  const wallMs = Date.now() - wallStart;

  if (prediction.status !== "succeeded") {
    throw new Error(`NSFW classifier ${prediction.status}: ${prediction.error || "unknown"}`);
  }

  // Replicate sometimes includes predict_time (sec) in metrics. Fall back to
  // wall-clock if it's missing — wall is an overestimate but never zero.
  const predictTimeSec: number =
    typeof prediction?.metrics?.predict_time === "number"
      ? prediction.metrics.predict_time
      : wallMs / 1000;
  recordUsage({
    user_id: userId ?? null,
    provider: "replicate",
    model: MODEL_SLUG,
    op: "nsfw",
    runtime_ms: Math.round(predictTimeSec * 1000),
    cost_usd: costForReplicateRuntime(MODEL_SLUG, predictTimeSec),
    metadata: { prediction_id: prediction.id ?? null },
  });

  const raw = String(prediction.output ?? "").toLowerCase().trim();
  const verdict: NsfwVerdict["verdict"] = raw.includes("nsfw") ? "nsfw" : "normal";
  return { verdict, raw };
}

async function getLatestVersion(token: string): Promise<string> {
  const res = await fetch(`${REPLICATE_API}/models/${MODEL_SLUG}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not fetch ${MODEL_SLUG} (${res.status})`);
  const body = await res.json();
  return body.latest_version.id;
}

async function postWithBackoff(url: string, init: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`${label} create failed (${res.status}): ${await res.text()}`);
      return res;
    }
    const body = await res.clone().json().catch(() => ({}));
    const wait = Math.max(1, Number(body?.retry_after) || 12);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error(`${label}: rate-limited after retries. Add more credit at https://replicate.com/account/billing to lift the throttle.`);
}
