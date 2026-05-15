import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Mark every batch OTHER than `keep_id` for this user as "cancelled",
 * and mark all of their non-done jobs as "skipped" so the worker stops
 * touching them. Used when the user wants to focus on their current
 * import and stop competing with stale prior attempts.
 *
 * Body: { keep_id: string }
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { keep_id?: string }));
  const keepId = typeof body?.keep_id === "string" ? body.keep_id : null;
  if (!keepId) {
    return NextResponse.json({ error: "keep_id required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Find every running batch for this user except the one we're keeping.
  const { data: otherBatches, error: listErr } = await supabase
    .from("job_batches")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running")
    .neq("id", keepId);
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }
  const ids = (otherBatches ?? []).map((b) => b.id as string);

  if (ids.length === 0) {
    return NextResponse.json({ cancelled_batches: 0, cancelled_jobs: 0 });
  }

  // Mark their pending/failed/processing jobs as skipped — frees the queue
  // worker from re-processing them.
  const { data: skippedJobs, error: jobsErr } = await supabase
    .from("jobs")
    .update({
      status: "skipped",
      error_message: "Cancelled — superseded by a newer batch",
    })
    .in("batch_id", ids)
    .in("status", ["pending", "failed", "processing"])
    .select("id");
  if (jobsErr) {
    return NextResponse.json({ error: jobsErr.message }, { status: 500 });
  }

  // Mark the batches themselves as cancelled.
  await supabase
    .from("job_batches")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .in("id", ids);

  return NextResponse.json({
    cancelled_batches: ids.length,
    cancelled_jobs: skippedJobs?.length ?? 0,
  });
}
