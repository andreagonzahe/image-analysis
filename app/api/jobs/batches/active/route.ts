import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Returns the user's currently-running job batches. The global BatchChecker
 * component polls this to decide whether to keep chain-firing the cron
 * worker — so the import keeps making progress no matter which page of
 * the app the user is sitting on.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ batches: [] });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ batches: [] });
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("job_batches")
    .select("id, label, status, total_jobs, done_jobs, failed_jobs, created_at")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false });
  return NextResponse.json({ batches: data ?? [] });
}
