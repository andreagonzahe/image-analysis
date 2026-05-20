import { NextResponse } from "next/server";
import { captionImage, type ImageTags } from "@/lib/captioner";
import { classifyNsfw } from "@/lib/nsfw";
import { decideStrategy } from "@/lib/strategist";
import { PLATFORMS } from "@/lib/platforms";
import type { AnalysisResult, ContentTier } from "@/lib/prompt";
import { fetchProfile } from "@/lib/profile-server";
import { requireUserId, isAuthEnabled } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const PAID_PLATFORMS = PLATFORMS.filter((p) => p.paid).map((p) => p.id);
const PAID_EXPLICIT_PLATFORMS = PLATFORMS.filter((p) => p.paid && p.policy === "explicit-ok").map((p) => p.id);
const FREE_PLATFORMS = PLATFORMS.filter((p) => !p.paid).map((p) => p.id);

const NUDITY_ATTIRE = new Set(["topless", "partial_nude", "fully_nude"]);

export async function POST(req: Request) {
  try {
    // Auth gate: if Clerk is enabled, require sign-in + allowlist before
    // running ANY paid inference. This is the main token-protection chokepoint.
    let userId: string | null = null;
    if (isAuthEnabled()) {
      userId = await requireUserId();
      if (!userId) {
        return NextResponse.json(
          { error: "Sign in required to run analysis." },
          { status: 401 }
        );
      }
    }

    const { imageDataUrl } = await req.json();
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "imageDataUrl must be a data: URL with an image MIME type" }, { status: 400 });
    }

    // Run NSFW classifier, captioner, and profile fetch in parallel.
    const [nsfw, captioned, profile] = await Promise.all([
      classifyNsfw(imageDataUrl, userId),
      captionImage(imageDataUrl, userId),
      fetchProfile(),
    ]);

    const strategy = await decideStrategy(captioned.description, nsfw.verdict, captioned.tags, profile, userId);

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
  // Hard nudity signals from the captioner — escalate to paywall tiers.
  if (tags.pose_intent === "explicit_act" || tags.sensuality === "explicit_sexual") return 5;
  if (tags.attire === "fully_nude") return 4;
  if (tags.attire === "topless" || tags.attire === "partial_nude") return 3;

  // Body-part fallback for when captioner missed attire but visible skin is named.
  const visible = new Set(tags.body_parts_visible);
  if (visible.has("genitals")) return 4;
  if (visible.has("breasts")) return 3;
  if (visible.has("buttocks") && tags.attire !== "swimwear" && tags.attire !== "lingerie") return 3;

  // NSFW verdict from the binary classifier — only trust it when the captioner
  // ALSO suggests skin or sexual framing. The classifier has false positives on
  // tight outfits, swimwear, low-cut tops, etc. If the captioner says
  // "fully_clothed" or "athletic" with neutral sensuality, trust the captioner.
  if (verdict === "nsfw") {
    const captionerSaysSfw =
      (tags.attire === "fully_clothed" || tags.attire === "athletic") &&
      tags.sensuality !== "erotic_intentional" &&
      tags.sensuality !== "explicit_sexual" &&
      tags.pose_intent !== "modeling_seductive" &&
      tags.pose_intent !== "explicit_act";
    if (captionerSaysSfw) return 1;
    // Otherwise the classifier and the captioner agree there's something risqué —
    // default to Tier 3 (soft paywall) instead of jumping straight to Tier 4.
    return 3;
  }

  // Tier 2 — suggestive but not nude.
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
        // Tier 3 → onlyfans_wall (paid sub feed loyalty content).
        // Tier 4-5 → onlyfans_ppv (DM unlock — never on the wall).
        const fallbackId = tier >= 4 ? "onlyfans_ppv" : "onlyfans_wall";
        const fallbackReason =
          tier >= 4
            ? "Re-routed by the funnel layer: tier 4-5 explicit content. Defaulting to OnlyFans PPV (DM unlock) — never on the wall, where subs would see it free and skip the unlock."
            : "Re-routed by the funnel layer: tier 3 paid content. Defaulting to OnlyFans paid wall — Tier-3 sweet spot for loyalty value without burning PPV revenue.";
        fixed.primary_recommendation = {
          platform: fallbackId,
          reason: fallbackReason,
          caption: fixed.primary_recommendation.caption,
          hashtags: [],
          wisdom: null,
          pricing_suggestion: null,
          post_type:
            tier >= 4
              ? { label: "PPV unlock", description: "Premium paywalled content sold per unlock in DMs." }
              : { label: "free for subscribers", description: "Loyalty content on the paid sub feed." },
          strategy_alignment:
            "This image goes behind a paywall. Tease the social funnel with a tier-2 (lingerie/implied) variant on onlyfans_free or social.",
        };
      }
    }

    const freeAlternativesRemoved = fixed.alternatives.filter((a) => FREE_PLATFORMS.includes(a.platform));
    fixed.alternatives = fixed.alternatives.filter((a) => PAID_PLATFORMS.includes(a.platform));

    const existingDontPost = new Set(fixed.do_not_post.map((d) => d.platform));
    const teaserHint = fixed.funnel_strategy?.teaser_variant_needed
      ? ` Instead: shoot a teaser variant (${fixed.funnel_strategy.teaser_variant_needed}) and post THAT here with a 'more on my ${platformDisplayName(fixed.primary_recommendation.platform)}' caption.`
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
