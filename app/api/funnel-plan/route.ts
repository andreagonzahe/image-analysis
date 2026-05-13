import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import { fetchProfile } from "@/lib/profile-server";
import { profileSummaryForPrompt } from "@/lib/profile";
import { FRAMEWORK_PROMPT_SUMMARY } from "@/lib/creator-framework";
import type { ImageTags } from "@/lib/captioner";
import type { ContentTier } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

type FunnelPlanRequest = {
  description: string;
  tags: ImageTags;
  content_tier: ContentTier;
  primary_platform: string;
  primary_caption?: string;
};

export type PlatformPlay = {
  platform: string;
  role: "post-as-is" | "shoot-teaser-variant" | "skip";
  what_to_post: string;        // 1-2 sentences describing what to actually post
  caption: string;              // platform-tuned caption
  cadence: string;              // e.g. "Tuesday + Friday, 2 per week"
  cta?: string;                 // optional, e.g. "more on my OF 🔥 link in bio"
  est_value: string;            // e.g. "Free post — ~5K reach", "$15-25 PPV unlock"
};

export type FunnelPlan = {
  weekly_revenue_estimate: { low: number; high: number; rationale: string };
  hero_platform: string;
  posting_order: string[];      // suggested order across the week
  plays: PlatformPlay[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FunnelPlanRequest;
    if (!body?.description || !body?.tags || !body?.primary_platform) {
      return NextResponse.json({ error: "description, tags, primary_platform required" }, { status: 400 });
    }

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TOGETHER_API_KEY not set" }, { status: 500 });
    }
    const model = process.env.TOGETHER_STRATEGIST_MODEL || DEFAULT_MODEL;

    const profile = await fetchProfile();
    const profileBlock = profileSummaryForPrompt(profile);

    const platformBlock = PLATFORMS.map((p) => `- ${p.id}: ${p.paid ? "PAID" : "FREE"}, ${p.policy}, audience: ${p.audience.slice(0, 100)}`).join("\n");

    const sys = `You are a creator-funnel strategist. Given one piece of content already analyzed by Postwise, you produce a week-long, platform-by-platform play for the creator. Connect the content to the broader funnel: top-of-funnel discovery → teaser → paywall → sale.

${FRAMEWORK_PROMPT_SUMMARY}

Output ONLY this JSON, no prose, no fences:

{
  "weekly_revenue_estimate": {
    "low": <int USD>,
    "high": <int USD>,
    "rationale": "1-2 sentences explaining what realistically drives the estimate (audience size if known, tier, platform mix)"
  },
  "hero_platform": "<the single most important platform for this piece, from the analyzed platforms list>",
  "posting_order": ["<platform_id>", "<platform_id>", ...],
  "plays": [
    {
      "platform": "<platform id>",
      "role": "post-as-is" | "shoot-teaser-variant" | "skip",
      "what_to_post": "1-2 sentences. If post-as-is: which version of the content. If shoot-teaser-variant: what teaser to shoot (lingerie chest-up, etc). If skip: 1 sentence on why.",
      "caption": "the actual caption text in that platform's voice (REQUIRED unless role=skip)",
      "cadence": "when in a week, how often",
      "cta": "optional CTA pointing to monetization platform — for free-platform funnels promoting paid content",
      "est_value": "what this play does for the funnel — 'free reach', '$15-25 PPV unlock', '5 new subs/wk', etc."
    }
  ]
}

# Rules
1. Include every platform where the creator could meaningfully act on this piece (skip ones that genuinely don't apply).
2. For Tier 3+ content: on free platforms, role MUST be "shoot-teaser-variant" or "skip" — never "post-as-is". For paid platforms, role is "post-as-is".
3. For Tier 1-2 content: on paid platforms, role is usually "shoot-teaser-variant" (suggesting a sexier complementary piece) OR "post-as-is" if it's natural loyalty content.
4. Use the creator's actively-posted platforms first when ranking.
5. The weekly revenue estimate should be honest. If they have no paid audience or this is Tier 1, estimate $0-X with rationale.
6. Captions must match platform voice (Instagram: warm + emoji; X: terse + link cue; Reddit: descriptive title; OF: intimate direct-address; etc.).
7. **Captions stand alone for this single image** — NEVER use "full set", "the set", "rest of the set", or any phrasing that implies a collection. Acceptable CTAs: "more on my OF 🔥 link in bio", "what didn't make the timeline is on Fansly", "uncropped on OF". The image speaks for itself.

# Available platforms
${platformBlock}`;

    const userPrompt = `${profileBlock ? profileBlock + "\n\n" : ""}CONTENT_TIER: ${body.content_tier}
PRIMARY_PLATFORM: ${body.primary_platform}
IMAGE_TAGS: ${JSON.stringify(body.tags)}
DESCRIPTION: ${body.description}
${body.primary_caption ? `\nPRIMARY_CAPTION: ${body.primary_caption}` : ""}

Produce the full weekly funnel plan now. Output ONLY the JSON.`;

    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Together API ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty response" }, { status: 500 });
    }

    let plan: FunnelPlan;
    try {
      plan = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        plan = JSON.parse(content.slice(start, end + 1));
      } else {
        return NextResponse.json({ error: "Could not parse plan JSON" }, { status: 500 });
      }
    }

    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
