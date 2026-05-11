import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import type { ImageTags } from "@/lib/captioner";

export const runtime = "nodejs";
export const maxDuration = 30;

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

type RewriteRequest = {
  platform: string;
  description: string;
  tags: ImageTags;
  current_caption: string;
  tone_hint?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RewriteRequest;
    const platform = PLATFORMS.find((p) => p.id === body.platform);
    if (!platform) {
      return NextResponse.json({ error: `Unknown platform: ${body.platform}` }, { status: 400 });
    }

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TOGETHER_API_KEY is not set" }, { status: 500 });
    }
    const model = process.env.TOGETHER_STRATEGIST_MODEL || DEFAULT_MODEL;

    const systemPrompt = `You are a creator copywriter. Rewrite a social media caption for the specified platform. Output ONLY the new caption text — no JSON, no prose, no quotes around it. The new caption MUST be different from the current one in voice, opening, or angle. Match the platform's house style exactly.

Platform: ${platform.name}
Audience: ${platform.audience}
Caption style: ${platform.captionStyle}
Hashtag norm: ${platform.hashtagNorm}
Best for: ${platform.bestFor}

Hashtags: include 0-${platform.hashtagNorm.includes("None") ? "0" : platform.hashtagNorm.includes("0-2") ? "2" : platform.hashtagNorm.includes("3-5") ? "5" : "10"} hashtags AT THE END of the caption, separated by spaces. If platform style says no hashtags, include none.

Rules:
- Match the platform voice exactly (LinkedIn = professional storytelling; TikTok = lowercase trend-forward; Reddit = descriptive title; OnlyFans = intimate direct address; X-NSFW = teasing with a link cue; Bluesky = chiller than X; Patreon = community-addressing).
- Don't repeat the user's current caption. Take a different angle (e.g., if the current opens with the visual, open with a feeling; if it asks a question, make a statement).
- Length per platform: Reddit 5-15 words title only. TikTok 1 short line. X/Bluesky 1-2 short lines. Instagram 2-4 sentences. LinkedIn 4-8 sentences with line breaks. OnlyFans/Fansly 2-3 sentences direct address. Patreon 3-5 sentences personal.`;

    const userPrompt = `IMAGE_TAGS:
${JSON.stringify(body.tags, null, 2)}

IMAGE_DESCRIPTION:
${body.description}

CURRENT CAPTION (do not repeat this — produce a different one):
${body.current_caption}
${body.tone_hint ? `\nTONE HINT: ${body.tone_hint}` : ""}

Write a new caption now. Output ONLY the caption text.`;

    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Together API ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "";
    raw = raw.trim().replace(/^["']|["']$/g, "");

    return NextResponse.json({ caption: raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
