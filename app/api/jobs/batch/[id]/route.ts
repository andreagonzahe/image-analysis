import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getBatch, listJobsForBatch } from "@/lib/jobs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Live status for a job batch. Returns the batch row + counts by job kind +
 * recent failures + a sample of the latest "done" results so the UI can show
 * what's been added to the vault.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const jobs = await listJobsForBatch(id, 5000);
  const counts = {
    pending: 0,
    processing: 0,
    done: 0,
    skipped: 0,
    failed: 0,
  } as Record<string, number>;
  const byKind = {
    prefilter: { pending: 0, processing: 0, done: 0, skipped: 0, failed: 0 },
    analyze_image: { pending: 0, processing: 0, done: 0, skipped: 0, failed: 0 },
  } as Record<string, Record<string, number>>;
  const recentFailures: Array<{ kind: string; error: string; name: string }> = [];
  const latestDoneAnalyses: string[] = [];

  for (const j of jobs) {
    counts[j.status] = (counts[j.status] ?? 0) + 1;
    if (byKind[j.kind]) byKind[j.kind][j.status] = (byKind[j.kind][j.status] ?? 0) + 1;
    if (j.status === "failed" && j.error_message && recentFailures.length < 10) {
      recentFailures.push({
        kind: j.kind,
        error: j.error_message.slice(0, 200),
        name: String(j.input?.name ?? j.id),
      });
    }
    if (j.kind === "analyze_image" && j.status === "done" && j.output?.post_id) {
      latestDoneAnalyses.push(String(j.output.post_id));
    }
  }

  // Pull the 6 most recent post records to surface in the live preview area
  let recentPosts: Array<{ id: string; content_rating: string; primary_platform: string; image_external_id: string | null; image_source: string }> = [];
  if (latestDoneAnalyses.length > 0) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("posts")
      .select("id, content_rating, primary_platform, image_external_id, image_source")
      .in("id", latestDoneAnalyses.slice(-6))
      .eq("user_id", userId);
    recentPosts = (data ?? []) as typeof recentPosts;
  }

  return NextResponse.json({
    batch,
    counts,
    by_kind: byKind,
    recent_failures: recentFailures,
    recent_posts: recentPosts,
  });
}
