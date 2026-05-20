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

import { recordUsage } from "./usage";
import { costForReplicateRuntime } from "./pricing";
import { CreditExhaustedError } from "./credit-errors";

const REPLICATE_API = "https://api.replicate.com/v1";

export type PrefilterVerdict = {
  keep: boolean;
  category: string; // "creator-content" | "selfie" | "lifestyle" | "screenshot" | "food" | "document" | "pet" | "group-photo" | "other"
  reason: string;
};

const PREFILTER_PROMPT = `You are a strict content-library curator for an adult creator. Your job is to REJECT anything that isn't a real photograph of the creator. When in doubt, SKIP.

# STEP 1 — is this a photograph at all, or is it a screen capture?

If the image shows TEXT, UI elements, app interfaces, browser windows, web pages, social feeds, chat messages, photo-app screens, settings menus, listings, receipts, documents, code, maps, weather widgets, notification banners, status bars, address bars, search bars, keyboards on screen — it's a SCREENSHOT. SKIP it.

A screenshot doesn't need text to be a screenshot. If the framing looks like a phone or computer display (rounded corners, status bar at top, app chrome) → still a screenshot. SKIP.

# STEP 2 — is the DOMINANT SUBJECT a non-human (animal, plant, object, food, scenery)?

This is the most common leak. Reject EVERY image whose main subject is:
- An animal of any kind: dog, cat, puppy, kitten, horse, cow, sheep, goat, pig, bird, parrot, chicken, duck, rabbit, hamster, guinea pig, ferret, snake, lizard, turtle, fish, dolphin, butterfly, insect, spider, wildlife
- A pet specifically (even if the creator's own pet — this is not OnlyFans material)
- A plushie, stuffed animal, soft toy, figurine, statue, sculpture, action figure, doll
- Food, drinks, plates, beverages, coffee art, dessert close-ups, cocktails, meal prep
- Scenery, landscape, beach (empty), sunset, mountains, ocean, clouds, sky photos
- Buildings, architecture, room interiors with no person, gym equipment alone, hotel lobby
- Cars, vehicles, gadgets, products, packaging, shopping hauls laid flat
- Flowers, plants, gardens, fruit, bouquets
- Art, paintings, drawings, posters, tattoos on hands held up alone

If an animal/object/scene is the main visual focus of the frame, SKIP — even if a human hand, foot, or shoulder is incidentally visible holding it or standing nearby. The creator's body parts must be the SUBJECT, not the bystander.

# STEP 3 — is there a visible PERSON as the SUBJECT?

The creator's library is for photos OF THE CREATOR. If there is no visible human figure (face, torso, legs, butt, breasts, full body — not just a fingertip or shadow), SKIP.

If there IS a person but they're NOT the creator (friends, family at a bar, group photos, kids, strangers in the background as the main subject) → also SKIP.

# WHEN TO KEEP

ONLY answer "KEEP" if ALL of these are true:
1. It's a real photograph (not a screen capture of anything)
2. The dominant subject is a HUMAN body — not an animal, object, scene, food, or plushie
3. The human appears to be the creator (a selfie, posed shot, modeling photo, full-body outfit shot, lingerie/boudoir, swimwear, lifestyle photo where they're clearly the focus)

# WHEN TO SKIP

EVERYTHING else. Be aggressive. False positives (keeping noise) cost the creator real Replicate + Together credit per photo. False negatives just mean they re-import that folder. The cost asymmetry says: lean toward SKIP.

# Output exactly

<KEEP or SKIP>: <one-word category>: <12-word reason>

Examples:
KEEP: selfie: mirror selfie, posed, in lingerie, clearly creator-shot
KEEP: modeling: full-body outdoor shot, creator posing in swimwear
SKIP: screenshot: text-message conversation captured from phone
SKIP: screenshot: real-estate listing screen capture, no creator
SKIP: screenshot: photo gallery view with multiple tile previews
SKIP: animal: dog sitting on couch, no human subject
SKIP: animal: close-up of cat face, no person in frame
SKIP: animal: puppy in lap, dog is the main subject not human
SKIP: animal: bird on windowsill, scenic shot of pet
SKIP: animal: aquarium fish, decorative shot
SKIP: plushie: teddy bear arranged on bed, no person
SKIP: no-person: sunset landscape, beautiful but nobody in frame
SKIP: food: food plate close-up, nobody visible
SKIP: object: outfit laid out flat on bed, no person wearing
SKIP: scenery: hotel room interior, empty bed shot, no model
SKIP: product: makeup haul flat-lay, no creator visible
SKIP: group-photo: bar photo with friends, not creator content

Answer now:`;

export async function prefilterImage(imageUrlOrDataUrl: string, userId?: string | null): Promise<PrefilterVerdict> {
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

  const wallStart = Date.now();
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
  const wallMs = Date.now() - wallStart;

  if (prediction.status !== "succeeded") {
    throw new Error(`Prefilter ${prediction.status}: ${prediction.error || "unknown"}`);
  }

  const predictTimeSec: number =
    typeof prediction?.metrics?.predict_time === "number"
      ? prediction.metrics.predict_time
      : wallMs / 1000;
  recordUsage({
    user_id: userId ?? null,
    provider: "replicate",
    model: modelSlug,
    op: "prefilter",
    runtime_ms: Math.round(predictTimeSec * 1000),
    cost_usd: costForReplicateRuntime(modelSlug, predictTimeSec),
    metadata: { prediction_id: prediction.id ?? null },
  });

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
  // Fallback: scan for "SKIP" first (more aggressive — we'd rather drop
  // a real photo than burn $0.01 analyzing a screenshot the model
  // confused itself describing).
  const upper = raw.toUpperCase();
  if (upper.includes("SKIP")) {
    return { keep: false, category: "other", reason: raw.slice(0, 200) };
  }
  if (upper.includes("KEEP")) {
    return { keep: true, category: "creator-content", reason: raw.slice(0, 200) };
  }
  // Last resort: SKIP. Garbled output is a model failure — better to lose
  // one keeper than to spend AI credit on noise we can't classify.
  return { keep: false, category: "unparseable", reason: raw.slice(0, 200) };
}

async function postWithBackoff(url: string, init: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          throw new CreditExhaustedError("replicate", `${label}: API token rejected (401): ${errText}`);
        }
        throw new Error(`${label} (${res.status}): ${errText}`);
      }
      return res;
    }
    const body = await res.clone().json().catch(() => ({}));
    const wait = Math.max(1, Number(body?.retry_after) || 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new CreditExhaustedError(
    "replicate",
    `${label}: rate-limited after retries. Likely account credit < $5.`
  );
}
