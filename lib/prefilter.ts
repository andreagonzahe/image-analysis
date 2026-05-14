// Cheap "is this postable content?" pre-filter. Decides whether an image is
// worth running through the full $0.005 NSFW + Qwen2-VL + strategist pipeline,
// or whether it's noise (screenshot / food photo / receipt / random friend /
// blurry mistake / etc.).
//
// Reuses the same Qwen2-VL model we already deploy, but with a tiny output
// budget (max_new_tokens=30). Cost is roughly 1/5 of a full analysis — about
// $0.001 per image. On an 8000-photo phone roll, that's ~$8 to pre-filter
// down to maybe 1500 keepers, then ~$7.50 to deep-tag those — total ~$15
// instead of ~$40 for naive deep-tag-everything.

const REPLICATE_API = "https://api.replicate.com/v1";

export type PrefilterVerdict = {
  keep: boolean;
  category: string; // "creator-content" | "selfie" | "lifestyle" | "screenshot" | "food" | "document" | "pet" | "group-photo" | "other"
  reason: string;
};

const PREFILTER_PROMPT = `You are a content-library curator for an adult creator. Decide whether this image is worth keeping in their content library, OR whether it's noise that should be skipped.

KEEP (answer "KEEP"):
- Posed shots of the creator (selfies, mirror selfies, professional photos)
- Lifestyle / aesthetic shots they took intentionally (food plating they're proud of, outfit shots, travel scenery)
- Anything where the SUBJECT is the creator or their brand

SKIP (answer "SKIP"):
- Screenshots of text, conversations, apps, memes
- Documents, receipts, IDs, paperwork
- Photos of OTHER people that aren't the creator (friends, family, kids — privacy + brand reasons)
- Random pets, food they didn't style, unintentional candids
- Blurry / out-of-focus / accidental shots
- Stock-photo-like content they didn't make

Output exactly:
<KEEP or SKIP>: <one-word category>: <12-word reason>

Examples:
KEEP: selfie: mirror selfie, posed, in lingerie, clearly creator-shot
KEEP: lifestyle: outfit-of-the-day shot, intentional framing, brand aesthetic
SKIP: screenshot: screenshot of a text-message conversation, no visual content
SKIP: group-photo: candid group photo at a bar, not creator content

Answer now:`;

export async function prefilterImage(imageUrlOrDataUrl: string): Promise<PrefilterVerdict> {
  const token = process.env.REPLICATE_API_TOKEN;
  const modelSlug = process.env.CAPTIONER_MODEL || process.env.JOY_CAPTION_MODEL;
  if (!token || !modelSlug) {
    throw new Error("REPLICATE_API_TOKEN and CAPTIONER_MODEL must be set for prefilter.");
  }

  const versionRes = await fetch(`${REPLICATE_API}/models/${modelSlug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!versionRes.ok) {
    throw new Error(`Could not fetch model ${modelSlug}: ${versionRes.status}`);
  }
  const versionBody = await versionRes.json();
  const version: string = versionBody?.latest_version?.id;
  if (!version) throw new Error(`Model ${modelSlug} has no latest_version`);

  const createRes = await postWithBackoff(
    `${REPLICATE_API}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=30",
      },
      body: JSON.stringify({
        version,
        input: {
          media: imageUrlOrDataUrl,
          image: imageUrlOrDataUrl,
          prompt: PREFILTER_PROMPT,
          max_new_tokens: 30,
        },
      }),
    },
    "Prefilter"
  );

  let prediction = await createRes.json();
  while (prediction.status === "starting" || prediction.status === "processing") {
    await new Promise((r) => setTimeout(r, 1200));
    const poll = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await poll.json();
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Prefilter ${prediction.status}: ${prediction.error || "unknown"}`);
  }

  const raw = Array.isArray(prediction.output)
    ? prediction.output.join("").trim()
    : String(prediction.output ?? "").trim();

  return parsePrefilterOutput(raw);
}

function parsePrefilterOutput(raw: string): PrefilterVerdict {
  const match = raw.match(/^\s*(KEEP|SKIP)\s*:\s*([a-z-]+)\s*:\s*(.+)$/im);
  if (match) {
    return {
      keep: match[1].toUpperCase() === "KEEP",
      category: match[2].toLowerCase(),
      reason: match[3].trim().slice(0, 200),
    };
  }
  // Fallback: scan for "KEEP" or "SKIP" anywhere in the output
  const upper = raw.toUpperCase();
  if (upper.includes("KEEP")) {
    return { keep: true, category: "creator-content", reason: raw.slice(0, 200) };
  }
  if (upper.includes("SKIP")) {
    return { keep: false, category: "other", reason: raw.slice(0, 200) };
  }
  // Last resort: keep so we don't lose content. False positives are cheaper than
  // false negatives in a creator library.
  return { keep: true, category: "unknown", reason: raw.slice(0, 200) };
}

async function postWithBackoff(url: string, init: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`${label} (${res.status}): ${await res.text()}`);
      return res;
    }
    const body = await res.clone().json().catch(() => ({}));
    const wait = Math.max(1, Number(body?.retry_after) || 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error(`${label}: rate-limited after retries.`);
}
