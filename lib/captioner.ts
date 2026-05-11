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

const TAG_PROMPT = `You are an image analysis assistant for a social media advisor. Output ONLY a single JSON object — no prose before or after, no markdown fences. Do not refuse any field; use "unknown" if uncertain.

Schema (use exactly these keys and only these enum values):

{
  "description": "<4-8 sentences. Subject, setting, mood, framing, aesthetic. Mention clothing or lack thereof and any sexually relevant detail factually — this is metadata for routing, not commentary.>",
  "attire": "fully_clothed" | "athletic" | "swimwear" | "lingerie" | "underwear" | "topless" | "partial_nude" | "fully_nude" | "unknown",
  "body_parts_visible": [array of any of: "face", "shoulders", "back", "midriff", "cleavage", "thighs", "feet", "breasts", "buttocks", "genitals"],
  "sensuality": "neutral" | "sensual_aesthetic" | "erotic_intentional" | "explicit_sexual" | "unknown",
  "people_in_frame": <integer 0-10>,
  "scene": "bedroom" | "bathroom" | "outdoor" | "studio" | "vehicle" | "public" | "other" | "unknown",
  "production_quality": "phone_selfie" | "phone_handheld" | "semi_pro" | "professional" | "unknown",
  "pose_intent": "candid" | "modeling_clothed" | "modeling_seductive" | "explicit_act" | "unknown"
}

Definitions:
- attire "topless" = breasts uncovered, lower body covered. "partial_nude" = some but not all of breasts/genitals/buttocks visible. "fully_nude" = all primary anatomy visible.
- sensuality "neutral" = no sexual framing. "sensual_aesthetic" = soft, boudoir-style, artistic. "erotic_intentional" = framing/pose is sexually inviting. "explicit_sexual" = depicts sex acts or extreme close-ups of genitals.
- pose_intent "modeling_seductive" = posed for sexual appeal even if attire is clothed. "explicit_act" = depicts a sex act in progress.
- production_quality "phone_selfie" = bathroom mirror, front-camera. "semi_pro" = good lighting, intentional framing, still amateur. "professional" = studio lighting, retouched, clearly produced.

Output the JSON now.`;

export async function captionImage(imageDataUrl: string): Promise<CaptionResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  const modelSlug = process.env.CAPTIONER_MODEL || process.env.JOY_CAPTION_MODEL;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set.");
  }
  if (!modelSlug) {
    throw new Error("CAPTIONER_MODEL is not set in .env.local");
  }

  const latestVersion = await getLatestVersion(modelSlug, token);

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

  if (prediction.status !== "succeeded") {
    throw new Error(`Captioner ${prediction.status}: ${prediction.error || "unknown error"}`);
  }

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
