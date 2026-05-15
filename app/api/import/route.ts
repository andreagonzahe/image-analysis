import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, listAllImages } from "@/lib/dropbox";
import { createBatch, enqueueJobs } from "@/lib/jobs";
import { getSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Most user libraries fit under this. If you have more than 50k photos in
// one folder you're an extreme outlier — split the import into a few
// sub-folders and run them separately.
const MAX_PER_IMPORT = 50000;

/**
 * When the user kicks off a new import, mark all of their prior still-running
 * batches as cancelled and skip their queued jobs. Prevents the new batch
 * from being starved by the worker draining older, abandoned imports first.
 */
async function cancelPriorRunningBatches(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: priorBatches } = await supabase
    .from("job_batches")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running");
  const ids = (priorBatches ?? []).map((b) => b.id as string);
  if (ids.length === 0) return;
  await supabase
    .from("jobs")
    .update({
      status: "skipped",
      error_message: "Cancelled — superseded by a newer import",
    })
    .in("batch_id", ids)
    .in("status", ["pending", "failed", "processing"]);
  await supabase
    .from("job_batches")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .in("id", ids);
}

/**
 * Kick off a Dropbox import:
 *   1. Scan the chosen folder for all image files
 *   2. Create a job batch
 *   3. Enqueue one "prefilter" job per image
 * After the batch is created, the cron worker drains the queue in the
 * background. The client polls /api/jobs/batch/[id] for progress.
 *
 * Body: { path: "/Photos/2026-Q2", notify_email?: "user@example.com" }
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const conn = await getConnectionForUser(userId);
  if (!conn) {
    return NextResponse.json({ error: "Connect Dropbox first" }, { status: 400 });
  }

  let body: { path?: string; notify_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const path = body.path ?? "";
  const dbPath = path === "/" ? "" : path;

  try {
    const { files: allFiles, truncated } = await listAllImages(
      conn.access_token,
      dbPath,
      MAX_PER_IMPORT
    );
    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No images found in that folder." }, { status: 400 });
    }

    // Dedup against the user's vault: skip Dropbox files we've already
    // analyzed and saved. Match by image_external_id (= Dropbox file ID).
    // The user's photo library often gets re-imported when they reorganize
    // folders; without this every retry would burn fresh Replicate credit
    // on photos we've already processed.
    const existingIds = await listExistingDropboxFileIds(userId);
    const files = allFiles.filter((f) => !existingIds.has(f.id));
    const skippedAsDuplicate = allFiles.length - files.length;
    const _truncated = truncated; // surface to client below
    if (files.length === 0) {
      return NextResponse.json({
        error: `All ${allFiles.length} files in this folder are already in your vault. Nothing new to import.`,
      }, { status: 400 });
    }

    // Cancel any prior running batches for this user before creating a new
    // one. Otherwise their pending jobs compete for the queue and the user
    // watches a "0/N" status page that's actually being starved by old work.
    await cancelPriorRunningBatches(userId);

    const batch = await createBatch({
      user_id: userId,
      kind: "dropbox_import",
      label: `Import from ${path || "/"}`,
      notify_email: body.notify_email,
      total_jobs: files.length,
    });

    // Enqueue prefilter jobs. Each carries the Dropbox file id so the worker
    // can fetch a temporary URL when it picks the job up (avoids stale URLs).
    await enqueueJobs(
      files.map((f) => ({
        user_id: userId,
        kind: "prefilter" as const,
        batch_id: batch.id,
        input: {
          source: "dropbox",
          dropbox_file_id: f.id,
          dropbox_path: f.path_display,
          name: f.name,
          size: f.size ?? 0,
        },
      }))
    );

    return NextResponse.json({
      batch_id: batch.id,
      count: files.length,
      skipped_as_duplicate: skippedAsDuplicate,
      truncated: _truncated,
      cap: MAX_PER_IMPORT,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Return the set of Dropbox file IDs already present in the user's vault.
 * Used to skip already-analyzed photos during a re-import. Paginated to
 * scale past Postgres's default 1000-row select cap.
 */
async function listExistingDropboxFileIds(userId: string): Promise<Set<string>> {
  const supabase = getSupabase();
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("posts")
      .select("image_external_id")
      .eq("user_id", userId)
      .eq("image_source", "dropbox")
      .not("image_external_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn("[import] listExistingDropboxFileIds error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.image_external_id) ids.add(r.image_external_id as string);
    }
    if (data.length < pageSize) break;
  }
  return ids;
}
