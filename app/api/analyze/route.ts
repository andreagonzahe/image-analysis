import { NextResponse } from "next/server";
import { captionImage, type ImageTags } from "@/lib/captioner";
import { classifyNsfw } from "@/lib/nsfw";
import { decideStrategy } from "@/lib/strategist";
import { PLATFORMS } from "@/lib/platforms";
import type { AnalysisResult, ContentTier } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const PAID_PLATFORMS = PLATFORMS.filter((p) => p.paid).map((p) => p.id);
const PAID_EXPLICIT_PLATFORMS = PLATFORMS.filter((p) => p.paid && p.policy === "explicit-ok").map((p) => p.id);
const FREE_PLATFORMS = PLATFORMS.filter((p) => !p.paid).map((p) => p.id);

const NUDITY_ATTIRE = new Set(["topless", "partial_nude", "fully_nude"]);

export async function POST(req: Request) {
  try {
    const { imageDataUrl } = await req.json();
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "imageDataUrl must be a data: URL with an image MIME type" }, { status: 400 });
    }

    const nsfw = await classifyNsfw(imageDataUrl);
    const captioned = await captionImage(imageDataUrl);

    const strategy = await decideStrategy(captioned.description, nsfw.verdict, captioned.tags);

    const enforced = enforcePolicy(strategy, nsfw.verdict, captioned.tags);

    return NextResponse.json({
      ...enforced,
      raw_description: captioned.description,
      tags: captioned.tags,
      nsfw_verdict: nsfw.verdict,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isNudityDetected(verdict: "nsfw" | "normal", tags: ImageTags): boolean {
  if (verdict === "nsfw") return true;
  if (NUDITY_ATTIRE.has(tags.attire)) return true;
  if (tags.sensuality === "explicit_sexual") return true;
  if (tags.pose_intent === "explicit_act") return true;
  const visible = new Set(tags.body_parts_visible);
  if (visible.has("breasts") || visible.has("genitals") || visible.has("buttocks")) return true;
  return false;
}

function inferTier(verdict: "nsfw" | "normal", tags: ImageTags): ContentTier {
  if (tags.pose_intent === "explicit_act" || tags.sensuality === "explicit_sexual") return 5;
  if (tags.attire === "fully_nude") return 4;
  if (tags.attire === "topless" || tags.attire === "partial_nude") return 3;
  if (verdict === "nsfw") return 4;
  if (
    tags.attire === "lingerie" ||
    tags.attire === "underwear" ||
    tags.attire === "swimwear" ||
    tags.sensuality === "erotic_intentional" ||
    tags.pose_intent === "modeling_seductive"
  ) {
    return 2;
  }
  return 1;
}

function enforcePolicy(strategy: AnalysisResult, verdict: "nsfw" | "normal", tags: ImageTags): AnalysisResult {
  const detectedTier = inferTier(verdict, tags);
  const reportedTier = Number(strategy.content_tier) as ContentTier;
  const tier = (detectedTier >= reportedTier ? detectedTier : reportedTier) as ContentTier;

  const fixed: AnalysisResult = { ...strategy, content_tier: tier };

  if (tier >= 3) {
    fixed.content_rating = "NSFW";

    if (!PAID_EXPLICIT_PLATFORMS.includes(fixed.primary_recommendation.platform)) {
      const paidAlt = fixed.alternatives.find((a) => PAID_EXPLICIT_PLATFORMS.includes(a.platform));
      if (paidAlt) {
        fixed.primary_recommendation = paidAlt;
      } else {
        fixed.primary_recommendation = {
          platform: "onlyfans",
          reason:
            "Re-routed by the funnel layer: this is paid-tier content (nudity detected). Defaulting to OnlyFans as the safest paid funnel destination.",
          caption: fixed.primary_recommendation.caption,
          hashtags: [],
          wisdom: null,
          pricing_suggestion: null,
          post_type: { label: "PPV unlock", description: "Premium paywalled content sold per unlock." },
          strategy_alignment:
            "This image goes behind a paywall. Tease the social funnel with a tier-2 (lingerie/implied) variant.",
        };
      }
    }

    const freeAlternativesRemoved = fixed.alternatives.filter((a) => FREE_PLATFORMS.includes(a.platform));
    fixed.alternatives = fixed.alternatives.filter((a) => PAID_PLATFORMS.includes(a.platform));

    const existingDontPost = new Set(fixed.do_not_post.map((d) => d.platform));
    const teaserHint = fixed.funnel_strategy?.teaser_variant_needed
      ? ` Instead: shoot a teaser variant (${fixed.funnel_strategy.teaser_variant_needed}) and post THAT here with a 'full set on ${platformDisplayName(fixed.primary_recommendation.platform)}' caption.`
      : ` Instead: shoot a Tier-2 lingerie/implied teaser variant for social, and keep this image exclusive to ${platformDisplayName(fixed.primary_recommendation.platform)}.`;

    for (const id of FREE_PLATFORMS) {
      if (existingDontPost.has(id)) continue;
      const p = PLATFORMS.find((pl) => pl.id === id);
      if (!p) continue;
      const policyNote =
        p.policy === "no-nudity"
          ? "Posting nudity here violates the platform's content policy AND gives away your paywalled content for free."
          : "Posting this image here for free defeats the paywall sale.";
      fixed.do_not_post.push({
        platform: id,
        reason: policyNote + teaserHint,
      });
    }

    for (const removed of freeAlternativesRemoved) {
      if (!fixed.do_not_post.some((d) => d.platform === removed.platform)) {
        fixed.do_not_post.push({
          platform: removed.platform,
          reason:
            "The strategist initially suggested this — overridden by the funnel rule. " +
            policyForPlatform(removed.platform) +
            teaserHint,
        });
      }
    }
  } else if (isNudityDetected(verdict, tags)) {
    fixed.content_rating = "NSFW";
  }

  return fixed;
}

function platformDisplayName(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.name ?? id;
}

function policyForPlatform(id: string): string {
  const p = PLATFORMS.find((pl) => pl.id === id);
  if (!p) return "Free platform.";
  if (p.policy === "no-nudity") return "This platform bans nudity.";
  if (p.policy === "suggestive-ok") return "This platform allows suggestive but not explicit content.";
  return "Free platform.";
}

export { isNudityDetected };
