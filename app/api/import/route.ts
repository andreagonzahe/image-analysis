import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, listAllImages } from "@/lib/dropbox";
import { createBatch, enqueueJobs } from "@/lib/jobs";
import { getSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PER_IMPORT = 10000;

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
    const files = await listAllImages(conn.access_token, dbPath, MAX_PER_IMPORT);
    if (files.length === 0) {
      return NextResponse.json({ error: "No images found in that folder." }, { status: 400 });
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

    return NextResponse.json({ batch_id: batch.id, count: files.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
