import { NextResponse } from "next/server";
import { captionImage, type ImageTags } from "@/lib/captioner";
import { classifyNsfw } from "@/lib/nsfw";
import { decideStrategy } from "@/lib/strategist";
import { PLATFORMS } from "@/lib/platforms";
import type { AnalysisResult } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const NO_NUDITY_PLATFORMS = PLATFORMS.filter((p) => p.policy === "no-nudity").map((p) => p.id);
const NSFW_OK_PLATFORMS = PLATFORMS.filter((p) => p.policy === "explicit-ok").map((p) => p.id);

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

function enforcePolicy(strategy: AnalysisResult, verdict: "nsfw" | "normal", tags: ImageTags): AnalysisResult {
  if (!isNudityDetected(verdict, tags)) return strategy;

  const fixed: AnalysisResult = { ...strategy, content_rating: "NSFW" };

  if (!NSFW_OK_PLATFORMS.includes(fixed.primary_recommendation.platform)) {
    const altMatch = fixed.alternatives.find((a) => NSFW_OK_PLATFORMS.includes(a.platform));
    if (altMatch) {
      const original = fixed.primary_recommendation;
      fixed.primary_recommendation = {
        ...altMatch,
        reason:
          altMatch.reason +
          " (Re-routed by the safety layer: nudity was detected, so we overrode the no-nudity platform pick.)",
      };
      fixed.alternatives = [
        ...fixed.alternatives.filter((a) => a.platform !== altMatch.platform),
        {
          ...original,
          reason:
            "Originally picked by the strategist — but this platform forbids nudity. Shown only as a reminder of what the captions WOULD have looked like there.",
        },
      ];
    } else {
      fixed.primary_recommendation = {
        platform: "reddit-nsfw",
        reason:
          "Re-routed by the safety layer: nudity was detected and the vision model didn't pick an adult-friendly platform. Defaulting to Reddit NSFW subs as the safest free funnel.",
        caption: fixed.primary_recommendation.caption,
        hashtags: [],
        wisdom: null,
        pricing_suggestion: null,
      };
    }
  }

  const existingDoNotPost = new Set(fixed.do_not_post.map((d) => d.platform));
  for (const id of NO_NUDITY_PLATFORMS) {
    if (existingDoNotPost.has(id)) continue;
    fixed.do_not_post.push({
      platform: id,
      reason: `Detected ${describeNudity(tags)} — this violates the platform's content policy and will result in removal plus account sanction (shadowban, suspension, or termination depending on history).`,
    });
  }

  fixed.alternatives = fixed.alternatives.filter(
    (a) => !NO_NUDITY_PLATFORMS.includes(a.platform) || a.reason.startsWith("Originally picked")
  );

  return fixed;
}

function describeNudity(tags: ImageTags): string {
  const parts: string[] = [];
  if (NUDITY_ATTIRE.has(tags.attire)) parts.push(`attire="${tags.attire}"`);
  const visible = tags.body_parts_visible.filter((p) => ["breasts", "buttocks", "genitals"].includes(p));
  if (visible.length) parts.push(`visible ${visible.join(", ")}`);
  if (tags.sensuality === "explicit_sexual") parts.push("explicit framing");
  if (tags.pose_intent === "explicit_act") parts.push("sex act in frame");
  return parts.length ? parts.join(", ") : "nudity";
}
