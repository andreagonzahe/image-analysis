import { NextResponse } from "next/server";
import {
  claimJobs,
  markJobDone,
  markJobFailed,
  markJobSkipped,
  enqueueJobs,
  pauseBatchOnCreditExhaustion,
  type Job,
} from "@/lib/jobs";
import { isCreditExhaustedError } from "@/lib/credit-errors";
import { getConnectionForUser, getTemporaryLink } from "@/lib/dropbox";
import { prefilterImage } from "@/lib/prefilter";
import { classifyNsfw } from "@/lib/nsfw";
import { captionImage } from "@/lib/captioner";
import { decideStrategy } from "@/lib/strategist";
import { fetchProfile } from "@/lib/profile-server";
import { clampPriceToProfile } from "@/lib/profile";
import { prepImageForReplicate } from "@/lib/image-prep-server";
import { sweepReplicateDeletions } from "@/lib/replicate-cleanup";
import {
  computeFingerprint,
  hammingDistance,
  phashFromString,
  phashToString,
  HAMMING_THRESHOLD,
  BLUR_THRESHOLD_LOOSE,
  TEXT_SCORE_THRESHOLD,
} from "@/lib/image-fingerprint";
import { PLATFORMS } from "@/lib/platforms";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import type { AnalysisResult, ContentTier } from "@/lib/prompt";
import type { ImageTags } from "@/lib/captioner";

export const runtime = "nodejs";
export const maxDuration = 60;

// 8 jobs/tick. Replicate's "regular" tier allows ~600 predictions/min with
// generous burst. 8 jobs × up to 3 Replicate calls each = ~24 concurrent
// — well within the tier. Lets a 9k-photo import finish in ~5-6h instead
// of ~10-15h. If credit ever drops below $5 the auto-pause kicks in
// before this becomes a problem; if you see sustained throttle warnings,
// knock back to 3.
const JOBS_PER_TICK = 8;

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

  // Always sample recent failures for diagnostic visibility — even on a
  // successful tick we want to surface what's been going wrong.
  const supabase0 = getSupabase();
  const { data: recentFailures } = await supabase0
    .from("jobs")
    .select("error_message, kind, attempts")
    .eq("status", "failed")
    .order("completed_at", { ascending: false })
    .limit(3);

  if (claimed.length === 0) {
    // Diagnostic: when nothing was claimed, look at what's actually in the
    // jobs table and return the breakdown. This is how we figure out why
    // a queue that "should" be moving isn't.
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const { data: all } = await supabase
      .from("jobs")
      .select("status, attempts, next_attempt_at, kind, batch_id")
      .order("created_at", { ascending: false })
      .limit(500);
    const byStatus: Record<string, number> = {};
    const byBatch: Record<string, Record<string, number>> = {};
    let blockedByAttempts = 0;
    let blockedByBackoff = 0;
    for (const j of all ?? []) {
      byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
      if ((j.status === "pending" || j.status === "failed") && (j.attempts ?? 0) >= 3) {
        blockedByAttempts++;
      }
      if (
        (j.status === "pending" || j.status === "failed") &&
        j.next_attempt_at &&
        j.next_attempt_at > nowIso
      ) {
        blockedByBackoff++;
      }
      const b = String(j.batch_id ?? "(no batch)");
      if (!byBatch[b]) byBatch[b] = {};
      byBatch[b][j.status] = (byBatch[b][j.status] ?? 0) + 1;
    }
    // Even when there's no work, sweep Replicate retention. Adult content
    // shouldn't linger on their servers any longer than necessary.
    const cleanupIdle = await sweepReplicateDeletions();
    return NextResponse.json({
      processed: 0,
      message: "No pending jobs.",
      cleanup: cleanupIdle,
      diagnostic: {
        scanned_recent: all?.length ?? 0,
        by_status: byStatus,
        by_batch: byBatch,
        blocked_by_max_attempts: blockedByAttempts,
        blocked_by_backoff: blockedByBackoff,
        now: nowIso,
        recent_failures: recentFailures ?? [],
      },
    });
  }

  // Process in parallel — Replicate has retry-on-429 built into our clients,
  // so concurrent jobs degrade gracefully under low-credit rate limits.
  const results = await Promise.allSettled(claimed.map((job) => processJob(job)));

  let done = 0;
  let failed = 0;
  type CreditExhaustion = { provider: string; details: string; batchId: string | null };
  const creditExhaustions: CreditExhaustion[] = [];
  const this_tick_errors: Array<{ kind: string; name: string; error: string }> = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      done++;
    } else {
      failed++;
      const job = claimed[i];
      this_tick_errors.push({
        kind: job.kind,
        name: String(job.input?.name ?? job.id),
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
      if (isCreditExhaustedError(r.reason)) {
        creditExhaustions.push({
          provider: r.reason.provider,
          details: r.reason.details,
          batchId: job.batch_id ?? null,
        });
      }
    }
  });

  // Halt the bleed: if ANY job failed with credit-exhausted, pause every
  // running batch for that user. Their pending jobs will sit untouched
  // (claimJobs filters paused batches) until they hit "Resume" after
  // topping up. Saves potentially hundreds of wasted attempts.
  const creditExhausted = creditExhaustions[0] ?? null;
  if (creditExhausted) {
    await pauseBatchOnCreditExhaustion(
      creditExhausted.batchId,
      `${creditExhausted.provider} out of credit — ${creditExhausted.details}`
    );
  }

  // Sweep Replicate retention as part of the same tick — keeps adult
  // images from sitting in their cache past the bare minimum window.
  const cleanup = await sweepReplicateDeletions();

  return NextResponse.json({
    processed: claimed.length,
    done,
    failed,
    this_tick_errors,
    recent_failures: recentFailures ?? [],
    cleanup,
    credit_exhausted: creditExhausted,
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
    if (job.kind === "screen") {
      await runScreen(job);
    } else if (job.kind === "prefilter") {
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

/**
 * Screen job — cheap, no AI calls. Fetches the Dropbox thumbnail,
 * computes pHash + blur. If blurry, skips immediately. Otherwise checks
 * for near-duplicates against earlier keepers in the same batch; if dup,
 * also skip. Survivors get a prefilter job enqueued.
 *
 * Why this exists: the AI calls (Qwen-VL, Together) cost ~$0.005-0.01
 * per image. Doing a free dedup + blur pre-screen typically drops 30-50%
 * of an unfiltered library before any paid call runs.
 */
async function runScreen(job: Job): Promise<void> {
  const supabase = getSupabase();
  const filename = String(job.input.name ?? "");

  // 1. Fetch the thumbnail (256×256 from Dropbox proxy). Tiny payload,
  //    no Replicate cost.
  const thumbBytes = await fetchScreenThumb(job.user_id, job.input);
  if (!thumbBytes) {
    // Couldn't get a thumb — let it through. Better to over-spend AI on
    // a fingerprint failure than to silently drop a real photo. No
    // phash to thread through; this post won't be dedup-able later.
    await enqueuePrefilterFromScreen(job, "");
    await markJobDone(job.id, {
      screened: true,
      kept: true,
      reason: "no-thumb-fingerprint-skipped",
    });
    return;
  }

  // 2. Compute fingerprint.
  const fp = await computeFingerprint(thumbBytes);
  if (!fp) {
    // Image format unrecognized by sharp — let it through.
    await enqueuePrefilterFromScreen(job, "");
    await markJobDone(job.id, {
      screened: true,
      kept: true,
      reason: "no-fingerprint-skipped",
    });
    return;
  }

  const phashStr = phashToString(fp.phash);

  // 3a. Text/UI screenshot check. Computes a flat-color uniformity
  //     score from the same 64×64 grayscale buffer the blur check
  //     uses — effectively free. If 55%+ of the pixels collapse into
  //     a single luminance bucket, the image is overwhelmingly flat
  //     color (chat background, document, app surface, web page) and
  //     not a real photo. Kill it here before the $0.001 Qwen-VL
  //     prefilter call.
  if (fp.text_score > TEXT_SCORE_THRESHOLD) {
    await markJobSkipped(
      job.id,
      `flat-color uniformity ${(fp.text_score * 100).toFixed(0)}% > ${(TEXT_SCORE_THRESHOLD * 100).toFixed(0)}% — likely a text/UI screenshot: ${filename}`
    );
    return;
  }

  // 3b. Blur check — loose threshold (BLUR_THRESHOLD_LOOSE = 25).
  if (fp.blur_score < BLUR_THRESHOLD_LOOSE) {
    await markJobSkipped(
      job.id,
      `blurry (Laplacian variance ${fp.blur_score.toFixed(1)} < ${BLUR_THRESHOLD_LOOSE}): ${filename}`
    );
    return;
  }

  // 4a. Cross-batch dedup — compare against EVERY existing vault post
  //     for this user. Catches the "re-imported the same Dropbox folder"
  //     case. RLS scopes this to the current user automatically.
  //     Backfilled phashes come from either (a) post insertion after
  //     this migration ran, or (b) the retroactive vault scanner which
  //     persists phashes for older posts as it walks them.
  const { data: vaultPhashes } = await supabase
    .from("posts")
    .select("phash")
    .eq("user_id", job.user_id)
    .not("phash", "is", null);
  for (const row of vaultPhashes ?? []) {
    if (!row.phash) continue;
    const vaultHash = phashFromString(row.phash as string);
    if (hammingDistance(fp.phash, vaultHash) <= HAMMING_THRESHOLD) {
      await markJobSkipped(
        job.id,
        `already in vault — same pose as an existing post (Hamming ≤ ${HAMMING_THRESHOLD})`
      );
      return;
    }
  }

  // 4b. Same-batch dedup — compare against earlier completed screens in
  //     the same batch that were marked as "kept". Catches dupes within
  //     the current import that haven't been written to posts yet.
  //     Limit to recent 1000 keepers for bounded comparison cost.
  if (job.batch_id) {
    const { data: earlierKeepers } = await supabase
      .from("jobs")
      .select("output")
      .eq("batch_id", job.batch_id)
      .eq("kind", "screen")
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(1000);
    for (const k of earlierKeepers ?? []) {
      const out = k.output as { kept?: boolean; phash?: string } | null;
      if (!out?.kept || !out.phash) continue;
      const earlierHash = phashFromString(out.phash);
      if (hammingDistance(fp.phash, earlierHash) <= HAMMING_THRESHOLD) {
        await markJobSkipped(
          job.id,
          `near-duplicate of an earlier shot in this batch (Hamming ≤ ${HAMMING_THRESHOLD})`
        );
        return;
      }
    }
  }

  // 5. Survived — enqueue prefilter + mark this screen as a keeper with
  //    the fingerprint stored for dedup checks of later screens AND for
  //    the eventual post insert (passed through the job chain).
  await enqueuePrefilterFromScreen(job, phashStr);
  await markJobDone(job.id, {
    screened: true,
    kept: true,
    phash: phashStr,
    blur_score: fp.blur_score,
    width: fp.width,
    height: fp.height,
  });
}

/**
 * Fetch a 256×256 thumbnail for an image source we can fingerprint
 * cheaply. Returns null if the source isn't supported.
 */
async function fetchScreenThumb(
  userId: string,
  input: Record<string, unknown>
): Promise<Buffer | null> {
  try {
    const source = String(input.source ?? "");
    if (source === "dropbox") {
      const { getConnectionForUser, getThumbnailBytes } = await import("@/lib/dropbox");
      const conn = await getConnectionForUser(userId);
      if (!conn) return null;
      const fileId = String(input.dropbox_file_id);
      const t = await getThumbnailBytes(conn.access_token, fileId, "w256h256");
      return t?.bytes ?? null;
    }
    // For url-sourced jobs, just fetch.
    if (typeof input.url === "string") {
      const r = await fetch(input.url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * After a screen passes, queue a prefilter job for the same file. We
 * attach the computed phash to the input payload so it rides through
 * prefilter → analyze and ends up persisted on the post — enabling
 * cross-batch dedup of future imports against this very post.
 */
async function enqueuePrefilterFromScreen(job: Job, phash: string): Promise<void> {
  // Drop screen_phash entirely if we couldn't compute one — keeps the
  // post-insert site simple (presence-only check) and avoids storing
  // an empty string that breaks future Hamming comparisons.
  const input = phash
    ? { ...job.input, screen_phash: phash }
    : job.input;
  await enqueueJobs([
    {
      user_id: job.user_id,
      kind: "prefilter" as const,
      batch_id: job.batch_id,
      input,
      priority: 5, // bump above further screens so the pipeline drains evenly
    },
  ]);
}

async function runPrefilter(job: Job): Promise<void> {
  const url = await resolveImageUrl(job.user_id, job.input);
  // Convert HEIC/HEIF to JPEG so Replicate's PIL can decode it. Other
  // formats pass through untouched (no extra fetch, no extra cost).
  const ready = await prepImageForReplicate(url, String(job.input.name ?? ""));
  const verdict = await prefilterImage(ready, job.user_id);

  if (!verdict.keep) {
    await markJobSkipped(job.id, `${verdict.category}: ${verdict.reason}`);
    return;
  }

  // Enqueue an analyze_image job for the keeper. Forward the full input
  // (incl. screen_phash, if present) so the analyzer can write the
  // perceptual hash to the post for future cross-batch dedup.
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
  // Convert HEIC once and reuse across all three downstream Replicate calls.
  // Avoids fetching + decoding the source three times when the file is HEIC.
  const ready = await prepImageForReplicate(url, String(job.input.name ?? ""));

  // Run NSFW + captioner in parallel — they're independent and both hit
  // Replicate's regular tier with plenty of burst headroom. Cuts analyze
  // wall-time roughly in half vs sequential. fetchProfile is Supabase, so
  // it just rides along.
  const [nsfw, captioned, profile] = await Promise.all([
    classifyNsfw(ready, job.user_id),
    captionImage(ready, job.user_id),
    fetchProfile(),
  ]);

  // Belt + suspenders: even if the prefilter let this through, the
  // captioner now confirms whether there's actually a person worth
  // posting. Three independent rejection signals — any one of them
  // drops the photo BEFORE paying Together for a strategy.
  const bodyParts = captioned.tags.body_parts_visible ?? [];
  const peopleInFrame = captioned.tags.people_in_frame ?? 0;
  const descLower = (captioned.description ?? "").toLowerCase();
  const filename = String(job.input.name ?? job.id);

  //  1. The obvious case: captioner saw nobody at all.
  if (peopleInFrame === 0 && bodyParts.length === 0) {
    await markJobSkipped(
      job.id,
      `Captioner confirmed no person in frame — prefilter false-positive. Filename: ${filename}`
    );
    return;
  }

  //  2. Animal / non-human dominance check. The captioner often
  //     mis-counts "people_in_frame" on pet photos (sees a paw or
  //     silhouette as a human). If the description prominently
  //     mentions an animal AND no specific human body parts were
  //     tagged, we treat it as pet content and skip.
  //
  //     Note: only matches when the keyword appears as the SUBJECT
  //     of the description (early in the text) — avoids false skips
  //     on "creator in lingerie holding her cat" where the cat is
  //     incidental. The first ~80 chars of a Qwen-VL caption almost
  //     always describes the primary subject.
  const ANIMAL_SUBJECT_KEYWORDS = [
    " dog", " puppy", " cat ", " kitten", " cats ",
    " horse", " pony", " cow ", " sheep", " goat",
    " pig ", " piglet", " bird ", " parrot", " chicken",
    " duck", " rabbit", " bunny", " hamster", " ferret",
    " snake", " lizard", " turtle", " tortoise", " fish ",
    " dolphin", " butterfly", " spider", " insect",
    " plushie", " stuffed animal", " teddy bear", " soft toy",
    " figurine", " statue ", " action figure", " doll ",
  ];
  const subjectChunk = " " + descLower.slice(0, 80) + " ";
  const animalHit = ANIMAL_SUBJECT_KEYWORDS.find((k) => subjectChunk.includes(k));
  if (animalHit && bodyParts.length === 0) {
    await markJobSkipped(
      job.id,
      `Captioner subject is non-human ("${animalHit.trim()}") and no body parts visible. Filename: ${filename}`
    );
    return;
  }

  //  3. Ambiguous-scene check. The captioner reports scene as
  //     "other"/"unknown" for non-photographic content (drawings,
  //     UI screenshots that slipped through, art). Combine with
  //     "no body parts" to drop these even if Qwen claimed a person.
  const scene = captioned.tags.scene ?? "unknown";
  if (
    (scene === "other" || scene === "unknown") &&
    bodyParts.length === 0 &&
    peopleInFrame <= 1
  ) {
    await markJobSkipped(
      job.id,
      `Captioner returned ambiguous scene + no body parts — likely non-photo content. Filename: ${filename}`
    );
    return;
  }

  const strategy = await decideStrategy(captioned.description, nsfw.verdict, captioned.tags, profile, job.user_id);
  const enforced = enforcePolicy(strategy, nsfw.verdict, captioned.tags);

  // Belt-and-suspenders: clamp the suggested price + price band to the
  // user's stated min/max bounds. This protects against the model
  // ignoring its routing-rules instructions on a long-tail edge case.
  clampPriceToProfile(enforced.primary_recommendation, profile);
  for (const alt of enforced.alternatives) {
    clampPriceToProfile(alt, profile);
  }

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
    // Persist the screen pass's pHash so future imports can dedup
    // against this post (cross-batch). Falls back to null if this job
    // came in through a path that skipped the screen pass.
    phash: typeof job.input.screen_phash === "string" ? job.input.screen_phash : null,
    // Parent folder of the source file. Used by the vault "By shoot"
    // view to group photos from the same session together.
    //   Dropbox:        "/OF Content/2025-05-12 shoot"  (parent of path_display)
    //   Direct upload:  null                            (UI buckets under "Direct uploads")
    source_folder: extractParentFolder(job.input),
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
/**
 * Pull the parent folder out of a job input so we can group vault posts
 * by "shoot" (the user's own Dropbox organization).
 *
 * For Dropbox imports, the file's `dropbox_path` looks like
 * "/OF Content/2025-05-12 shoot/IMG_001.jpg" — we want
 * "/OF Content/2025-05-12 shoot" as the folder. For non-Dropbox
 * sources (direct upload), there's no folder structure to honor →
 * null, UI buckets these under "Direct uploads."
 */
function extractParentFolder(input: Record<string, unknown>): string | null {
  if (input.source !== "dropbox") return null;
  const path = typeof input.dropbox_path === "string" ? input.dropbox_path : null;
  if (!path) return null;
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0) return null; // "/file.jpg" → root, no folder
  return path.slice(0, lastSlash);
}

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
        // Tier 3 → onlyfans_wall (paid feed loyalty content).
        // Tier 4-5 → onlyfans_ppv (DM unlock — never on the wall).
        const fallbackId = tier >= 4 ? "onlyfans_ppv" : "onlyfans_wall";
        const fallbackReason =
          tier >= 4
            ? "Re-routed by the funnel layer: tier 4-5 explicit content. Defaulting to OnlyFans PPV — never on the wall."
            : "Re-routed by the funnel layer: tier 3 paid content. Defaulting to OnlyFans paid wall.";
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
          strategy_alignment: "Paid-only. Tease the funnel with a tier-2 variant on onlyfans_free or social.",
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
