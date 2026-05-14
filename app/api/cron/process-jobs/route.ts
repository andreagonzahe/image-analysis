import { NextResponse } from "next/server";
import {
  claimJobs,
  markJobDone,
  markJobFailed,
  markJobSkipped,
  enqueueJobs,
  type Job,
} from "@/lib/jobs";
import { getConnectionForUser, getTemporaryLink } from "@/lib/dropbox";
import { prefilterImage } from "@/lib/prefilter";
import { classifyNsfw } from "@/lib/nsfw";
import { captionImage } from "@/lib/captioner";
import { decideStrategy } from "@/lib/strategist";
import { fetchProfile } from "@/lib/profile-server";
import { PLATFORMS } from "@/lib/platforms";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import type { AnalysisResult, ContentTier } from "@/lib/prompt";
import type { ImageTags } from "@/lib/captioner";

export const runtime = "nodejs";
export const maxDuration = 60;

const JOBS_PER_TICK = 5;

const NO_NUDITY_PLATFORMS = PLATFORMS.filter((p) => p.policy === "no-nudity").map((p) => p.id);
const PAID_PLATFORMS = PLATFORMS.filter((p) => p.paid).map((p) => p.id);
const PAID_EXPLICIT_PLATFORMS = PLATFORMS.filter((p) => p.paid && p.policy === "explicit-ok").map((p) => p.id);
const FREE_PLATFORMS = PLATFORMS.filter((p) => !p.paid).map((p) => p.id);
const NUDITY_ATTIRE = new Set(["topless", "partial_nude", "fully_nude"]);

export async function POST(req: Request) {
  // Auth: either via Vercel Cron header, or a manual trigger with the CRON_SECRET.
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const claimed = await claimJobs(JOBS_PER_TICK);
  if (claimed.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending jobs." });
  }

  // Process in parallel — Replicate has retry-on-429 built into our clients,
  // so concurrent jobs degrade gracefully under low-credit rate limits.
  const results = await Promise.allSettled(claimed.map((job) => processJob(job)));

  let done = 0;
  let failed = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled") done++;
    else failed++;
  });

  return NextResponse.json({
    processed: claimed.length,
    done,
    failed,
  });
}

// Vercel also invokes cron via GET — accept both verbs.
export const GET = POST;

function authorized(req: Request): boolean {
  // Vercel Cron sets the "x-vercel-cron-signature" header automatically.
  // For manual / local testing, accept a CRON_SECRET header.
  const cronHeader = req.headers.get("x-vercel-cron-signature");
  if (cronHeader) return true;

  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization") ?? req.headers.get("x-cron-secret");
  if (!expected) {
    // If no CRON_SECRET is set, allow only on localhost so dev can test
    return process.env.NODE_ENV !== "production";
  }
  if (provided === `Bearer ${expected}` || provided === expected) return true;
  return false;
}

async function processJob(job: Job): Promise<void> {
  try {
    if (job.kind === "prefilter") {
      await runPrefilter(job);
    } else if (job.kind === "analyze_image") {
      await runAnalyze(job);
    } else {
      await markJobSkipped(job.id, `Unknown kind: ${job.kind}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFailed(job.id, message);
    throw err;
  }
}

/** Resolve a source URL we can hand to Replicate, regardless of where the image lives. */
async function resolveImageUrl(userId: string, input: Record<string, unknown>): Promise<string> {
  const source = String(input.source ?? "");
  if (source === "dropbox") {
    const conn = await getConnectionForUser(userId);
    if (!conn) throw new Error("Dropbox not connected.");
    const fileId = String(input.dropbox_file_id);
    return await getTemporaryLink(conn.access_token, fileId);
  }
  if (typeof input.url === "string") return input.url;
  throw new Error(`Unsupported job input source: ${source}`);
}

async function runPrefilter(job: Job): Promise<void> {
  const url = await resolveImageUrl(job.user_id, job.input);
  const verdict = await prefilterImage(url);

  if (!verdict.keep) {
    await markJobSkipped(job.id, `${verdict.category}: ${verdict.reason}`);
    return;
  }

  // Enqueue an analyze_image job for the keeper. Same input payload so the
  // analyzer can resolve a fresh Dropbox temp URL when it runs.
  await enqueueJobs([
    {
      user_id: job.user_id,
      kind: "analyze_image" as const,
      batch_id: job.batch_id,
      input: job.input,
      priority: 5, // bump above prefilter so analysis catches up
    },
  ]);

  await markJobDone(job.id, {
    keep: true,
    category: verdict.category,
    reason: verdict.reason,
  });
}

async function runAnalyze(job: Job): Promise<void> {
  const url = await resolveImageUrl(job.user_id, job.input);

  const [nsfw, captioned, profile] = await Promise.all([
    classifyNsfw(url),
    captionImage(url),
    fetchProfile(),
  ]);

  const strategy = await decideStrategy(captioned.description, nsfw.verdict, captioned.tags, profile);
  const enforced = enforcePolicy(strategy, nsfw.verdict, captioned.tags);

  // Persist to vault. For Dropbox-sourced items we record the external id
  // instead of duplicating bytes into Supabase Storage.
  const supabase = getSupabase();
  const pricing = enforced.primary_recommendation.pricing_suggestion;
  const postId = crypto.randomUUID();

  const row = {
    id: postId,
    user_id: job.user_id,
    created_at: new Date().toISOString(),
    analysis: {
      ...enforced,
      raw_description: captioned.description,
      tags: captioned.tags,
      nsfw_verdict: nsfw.verdict,
    },
    content_rating: enforced.content_rating,
    primary_platform: enforced.primary_recommendation.platform,
    primary_price_low: pricing?.low_usd ?? -1,
    primary_price_high: pricing?.high_usd ?? -1,
    image_source: job.input.source === "dropbox" ? "dropbox" : "supabase_storage",
    image_external_id: job.input.source === "dropbox" ? (job.input.dropbox_file_id as string) : null,
    image_path: null as string | null,
    status: "pending",
  };

  const { error } = await supabase.from("posts").insert(row);
  if (error) throw new Error(`Could not save analysis: ${error.message}`);

  await markJobDone(job.id, {
    post_id: postId,
    content_rating: enforced.content_rating,
    primary_platform: enforced.primary_recommendation.platform,
  });
}

/**
 * Same logic as /api/analyze/route.ts enforcePolicy — duplicated here so the
 * worker doesn't depend on the request-time route file.
 */
function inferTier(verdict: "nsfw" | "normal", tags: ImageTags): ContentTier {
  if (tags.pose_intent === "explicit_act" || tags.sensuality === "explicit_sexual") return 5;
  if (tags.attire === "fully_nude") return 4;
  if (tags.attire === "topless" || tags.attire === "partial_nude") return 3;

  const visible = new Set(tags.body_parts_visible);
  if (visible.has("genitals")) return 4;
  if (visible.has("breasts")) return 3;
  if (visible.has("buttocks") && tags.attire !== "swimwear" && tags.attire !== "lingerie") return 3;

  if (verdict === "nsfw") {
    const captionerSaysSfw =
      (tags.attire === "fully_clothed" || tags.attire === "athletic") &&
      tags.sensuality !== "erotic_intentional" &&
      tags.sensuality !== "explicit_sexual" &&
      tags.pose_intent !== "modeling_seductive" &&
      tags.pose_intent !== "explicit_act";
    if (captionerSaysSfw) return 1;
    return 3;
  }

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
          reason: "Re-routed by the funnel layer: paid-tier content. Defaulting to OnlyFans.",
          caption: fixed.primary_recommendation.caption,
          hashtags: [],
          wisdom: null,
          pricing_suggestion: null,
          post_type: { label: "PPV unlock", description: "Premium paywalled content sold per unlock." },
          strategy_alignment: "Paid-only. Tease the funnel with a tier-2 variant.",
        };
      }
    }
    fixed.alternatives = fixed.alternatives.filter((a) => PAID_PLATFORMS.includes(a.platform));

    const existing = new Set(fixed.do_not_post.map((d) => d.platform));
    for (const id of NO_NUDITY_PLATFORMS) {
      if (existing.has(id)) continue;
      const p = PLATFORMS.find((pl) => pl.id === id);
      if (!p) continue;
      fixed.do_not_post.push({
        platform: id,
        reason: "Detected nudity violates this platform's content policy AND gives away your paywalled content for free.",
      });
    }
  } else if (verdict === "nsfw") {
    fixed.content_rating = "NSFW";
  }

  return fixed;
}
