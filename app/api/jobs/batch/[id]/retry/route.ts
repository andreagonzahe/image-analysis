import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getBatch } from "@/lib/jobs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Reset every non-done job in this batch back to "pending" so the worker
 * picks them up again. Useful when a batch ran while a dependency was
 * broken (e.g. Dropbox token expired mid-import) — jobs hit MAX_ATTEMPTS
 * and froze. This unsticks them.
 *
 * Resets: status -> pending, attempts -> 0, started_at -> null,
 *         next_attempt_at -> null, error_message -> null.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const { id } = await params;
  const batch = await getBatch(id, userId);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const supabase = getSupabase();

  // Reset every job in this batch that isn't already done or skipped.
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "pending",
      attempts: 0,
      started_at: null,
      next_attempt_at: null,
      error_message: null,
    })
    .eq("batch_id", id)
    .in("status", ["failed", "processing", "pending"])
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-open the batch so the status page knows work is in flight again.
  await supabase
    .from("job_batches")
    .update({ status: "running", completed_at: null })
    .eq("id", id);

  return NextResponse.json({ reset: data?.length ?? 0 });
}
