import { recordUsage } from "./usage";
import { costForReplicateRuntime } from "./pricing";

const REPLICATE_API = "https://api.replicate.com/v1";

export type ImageTags = {
  attire: "fully_clothed" | "athletic" | "swimwear" | "lingerie" | "underwear" | "topless" | "partial_nude" | "fully_nude" | "unknown";
  body_parts_visible: string[];
  sensuality: "neutral" | "sensual_aesthetic" | "erotic_intentional" | "explicit_sexual" | "unknown";
  people_in_frame: number;
  scene: "bedroom" | "bathroom" | "outdoor" | "studio" | "vehicle" | "public" | "other" | "unknown";
  production_quality: "phone_selfie" | "phone_handheld" | "semi_pro" | "professional" | "unknown";
  pose_intent: "candid" | "modeling_clothed" | "modeling_seductive" | "explicit_act" | "unknown";
};

export type CaptionResult = {
  description: string;
  tags: ImageTags;
};

const TAG_PROMPT = `You are an image classifier. Output ONLY a single JSON object — no prose, no markdown fences. Do not refuse any field.

# Note on video montages

If the input looks like a 3x3 grid of similar frames (a video montage of 9 frames over time, read left-to-right top-to-bottom — earlier frames are top-left, later frames are bottom-right), treat it as ONE piece of content and describe the overall video. Tag attire/sensuality/etc. based on the MOST INTENSE frame (e.g., if one frame shows nudity and others don't, tag the whole thing at that level — the user is the one who shot the video and intends to post it as a unit). In the description, briefly note the temporal arc if it's interesting ("starts clothed, becomes implied nude" or "consistent throughout").

# Bias to be conservative

When uncertain or ambiguous, prefer the LOWER-intensity option. Specifically:
- Default attire to "fully_clothed" unless skin or undergarments are CLEARLY the primary visible garment.
- Default sensuality to "neutral" unless the framing is OBVIOUSLY sexual.
- Default pose_intent to "candid" or "modeling_clothed" unless explicitly seductive.
- A normal photo of a person — even a stylized fashion shot, even a bedroom selfie in clothes, even a tight dress, even with cleavage — is "fully_clothed" / "neutral" / "candid". Most photos are not adult content. Treat anything ambiguous as SFW.

# Schema (use exactly these keys and only these enum values)

{
  "description": "<4-8 sentences. Subject, setting, mood, framing. Be factual; mention attire and any relevant detail neutrally.>",
  "attire": "fully_clothed" | "athletic" | "swimwear" | "lingerie" | "underwear" | "topless" | "partial_nude" | "fully_nude" | "unknown",
  "body_parts_visible": [array of any of: "face", "shoulders", "back", "midriff", "cleavage", "thighs", "feet", "breasts", "buttocks", "genitals"],
  "sensuality": "neutral" | "sensual_aesthetic" | "erotic_intentional" | "explicit_sexual" | "unknown",
  "people_in_frame": <integer 0-10>,
  "scene": "bedroom" | "bathroom" | "outdoor" | "studio" | "vehicle" | "public" | "other" | "unknown",
  "production_quality": "phone_selfie" | "phone_handheld" | "semi_pro" | "professional" | "unknown",
  "pose_intent": "candid" | "modeling_clothed" | "modeling_seductive" | "explicit_act" | "unknown"
}

# Attire definitions (STRICT — read carefully)

- "fully_clothed": Normal clothing covers the torso. This includes: dresses (any tightness — bodycon, mini, midi, evening), jumpsuits, jeans + top, crop top + jeans, bedroom selfie in pajamas, fashion shots, blazers, sweaters, cocktail dresses, work clothes, anything with full-coverage clothes as the primary visible garment. Cleavage in a low-cut top is STILL fully_clothed.
- "athletic": Sports bra + leggings, gym wear with full coverage on torso. Yoga clothes.
- "swimwear": Bikini or one-piece swimsuit, clearly intended for swimming, in or near water OR clearly a swimsuit photoshoot.
- "lingerie": Bra-and-panties SET worn as the primary garment (intentional lingerie modeling — not a regular bra strap peeking out). Implies styled, photographed, intentional.
- "underwear": Underwear (bra/panties) as primary garment, less styled than lingerie (e.g., everyday lingerie/loungewear shot, mirror selfie in underwear).
- "topless": Breasts physically uncovered and visible. NOT cleavage. NOT covered by hands/hair/objects.
- "partial_nude": Some — but not all — of breasts/genitals/buttocks uncovered and visible.
- "fully_nude": All primary anatomy uncovered.

**Rule of thumb: if you would not describe the person as "wearing underwear" in a sentence, do not tag attire as "lingerie" or "underwear". Tight clothes are NOT underwear.**

# body_parts_visible

Only list parts where SKIN is uncovered and physically visible. "cleavage" can be listed if visible. Do NOT list "breasts" if a top covers them — covered cleavage is just "cleavage". Only list "breasts" if breast tissue itself is uncovered.

# sensuality

- "neutral": no sexual framing. A smiling clothed photo is neutral.
- "sensual_aesthetic": soft, boudoir-style, artistic. Lighting and pose are sensual but not explicit. Usually paired with swimwear/lingerie/topless attire.
- "erotic_intentional": framing/pose is sexually inviting. Usually paired with at least swimwear or skin-revealing attire.
- "explicit_sexual": depicts sex acts or extreme close-ups of genitals.

# pose_intent

- "candid": natural, not posed for camera (laughing, doing something).
- "modeling_clothed": posing for camera in clothes — fashion-style, magazine-style.
- "modeling_seductive": posing in a sexually-inviting way (this REQUIRES at minimum swimwear/lingerie attire OR clearly suggestive framing in clothes — don't tag modeling_seductive just because someone looks attractive).
- "explicit_act": depicts a sex act in progress.

# production_quality

- "phone_selfie": bathroom mirror, front-camera, casual.
- "phone_handheld": phone-quality but framed/intentional.
- "semi_pro": good lighting, intentional framing, still amateur.
- "professional": studio lighting, retouched, clearly produced.

Output the JSON now.`;

export async function captionImage(imageDataUrl: string, userId?: string | null): Promise<CaptionResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  const modelSlug = process.env.CAPTIONER_MODEL || process.env.JOY_CAPTION_MODEL;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set.");
  }
  if (!modelSlug) {
    throw new Error("CAPTIONER_MODEL is not set in .env.local");
  }

  const latestVersion = await getLatestVersion(modelSlug, token);

  const wallStart = Date.now();
  const createRes = await postWithBackoff(
    `${REPLICATE_API}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        version: latestVersion,
        input: {
          media: imageDataUrl,
          image: imageDataUrl,
          prompt: TAG_PROMPT,
          max_new_tokens: 512,
        },
      }),
    },
    "Captioner"
  );

  let prediction = await createRes.json();

  while (prediction.status === "starting" || prediction.status === "processing") {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate poll failed (${pollRes.status})`);
    prediction = await pollRes.json();
  }
  const wallMs = Date.now() - wallStart;

  if (prediction.status !== "succeeded") {
    throw new Error(`Captioner ${prediction.status}: ${prediction.error || "unknown error"}`);
  }

  const predictTimeSec: number =
    typeof prediction?.metrics?.predict_time === "number"
      ? prediction.metrics.predict_time
      : wallMs / 1000;
  recordUsage({
    user_id: userId ?? null,
    provider: "replicate",
    model: modelSlug,
    op: "captioner",
    runtime_ms: Math.round(predictTimeSec * 1000),
    cost_usd: costForReplicateRuntime(modelSlug, predictTimeSec),
    metadata: { prediction_id: prediction.id ?? null },
  });

  const raw = Array.isArray(prediction.output) ? prediction.output.join("").trim() : String(prediction.output ?? "").trim();
  return parseTaggedOutput(raw);
}

function parseTaggedOutput(raw: string): CaptionResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        json = JSON.parse(raw.slice(start, end + 1));
      } catch {
        return fallback(raw);
      }
    } else {
      return fallback(raw);
    }
  }
  const j = json as Record<string, unknown>;
  const tags: ImageTags = {
    attire: safeEnum(j.attire, ["fully_clothed", "athletic", "swimwear", "lingerie", "underwear", "topless", "partial_nude", "fully_nude", "unknown"]),
    body_parts_visible: Array.isArray(j.body_parts_visible) ? j.body_parts_visible.map(String) : [],
    sensuality: safeEnum(j.sensuality, ["neutral", "sensual_aesthetic", "erotic_intentional", "explicit_sexual", "unknown"]),
    people_in_frame: typeof j.people_in_frame === "number" ? j.people_in_frame : 0,
    scene: safeEnum(j.scene, ["bedroom", "bathroom", "outdoor", "studio", "vehicle", "public", "other", "unknown"]),
    production_quality: safeEnum(j.production_quality, ["phone_selfie", "phone_handheld", "semi_pro", "professional", "unknown"]),
    pose_intent: safeEnum(j.pose_intent, ["candid", "modeling_clothed", "modeling_seductive", "explicit_act", "unknown"]),
  };
  return {
    description: typeof j.description === "string" && j.description.trim().length > 0 ? j.description.trim() : raw.slice(0, 600),
    tags,
  };
}

function safeEnum<T extends readonly string[]>(v: unknown, allowed: T): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : ("unknown" as T[number]);
}

function fallback(raw: string): CaptionResult {
  return {
    description: raw.slice(0, 800),
    tags: {
      attire: "unknown",
      body_parts_visible: [],
      sensuality: "unknown",
      people_in_frame: 0,
      scene: "unknown",
      production_quality: "unknown",
      pose_intent: "unknown",
    },
  };
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

async function getLatestVersion(slug: string, token: string): Promise<string> {
  const res = await fetch(`${REPLICATE_API}/models/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Could not fetch Replicate model "${slug}" (${res.status}). ${errText}`);
  }
  const body = await res.json();
  const versionId: string | undefined = body?.latest_version?.id;
  if (!versionId) throw new Error(`Replicate model "${slug}" has no latest_version`);
  return versionId;
}
