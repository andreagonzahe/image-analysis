import { NextResponse } from "next/server";
import { decideStrategy } from "@/lib/strategist";
import { PLATFORMS } from "@/lib/platforms";
import type { ImageTags } from "@/lib/captioner";
import type { AnalysisResult, ContentTier } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAID_PLATFORMS = PLATFORMS.filter((p) => p.paid).map((p) => p.id);
const PAID_EXPLICIT_PLATFORMS = PLATFORMS.filter((p) => p.paid && p.policy === "explicit-ok").map((p) => p.id);
const FREE_PLATFORMS = PLATFORMS.filter((p) => !p.paid).map((p) => p.id);

type ReTierRequest = {
  description: string;
  tags: ImageTags;
  nsfw_verdict: "nsfw" | "normal";
  forced_tier: ContentTier;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReTierRequest;
    if (!body?.description || !body?.tags || !body?.forced_tier) {
      return NextResponse.json({ error: "description, tags, and forced_tier required" }, { status: 400 });
    }
    if (![1, 2, 3, 4, 5].includes(body.forced_tier)) {
      return NextResponse.json({ error: "forced_tier must be 1-5" }, { status: 400 });
    }

    // Re-run the strategist. The prompt is unchanged — we tell it the user's
    // chosen tier in the user message so it routes accordingly.
    const strategy = await decideStrategy(
      body.description + `\n\nUSER OVERRIDE: This image is content_tier ${body.forced_tier}. Route accordingly.`,
      body.nsfw_verdict,
      body.tags
    );

    const enforced = enforceForTier(strategy, body.forced_tier);

    return NextResponse.json({
      ...enforced,
      raw_description: body.description,
      tags: body.tags,
      nsfw_verdict: body.nsfw_verdict,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function enforceForTier(strategy: AnalysisResult, tier: ContentTier): AnalysisResult {
  const fixed: AnalysisResult = { ...strategy, content_tier: tier };

  if (tier >= 3) {
    fixed.content_rating = "NSFW";
    if (!PAID_EXPLICIT_PLATFORMS.includes(fixed.primary_recommendation.platform)) {
      const paidAlt = fixed.alternatives.find((a) => PAID_EXPLICIT_PLATFORMS.includes(a.platform));
      if (paidAlt) fixed.primary_recommendation = paidAlt;
    }
    fixed.alternatives = fixed.alternatives.filter((a) => PAID_PLATFORMS.includes(a.platform));
  } else if (tier === 1) {
    // SFW — make sure primary isn't a paid explicit platform.
    fixed.content_rating = "SFW";
    if (PAID_EXPLICIT_PLATFORMS.includes(fixed.primary_recommendation.platform)) {
      const freeAlt = fixed.alternatives.find((a) => FREE_PLATFORMS.includes(a.platform));
      if (freeAlt) fixed.primary_recommendation = freeAlt;
    }
  } else if (tier === 2) {
    fixed.content_rating = "suggestive";
  }

  return fixed;
}
