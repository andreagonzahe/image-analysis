import { NextResponse } from "next/server";
import { requireUserId, isAdminUser } from "@/lib/auth";
import { pauseBatchOnCreditExhaustion } from "@/lib/jobs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Test-only endpoint that pretends a Together or Replicate credit error
 * just fired against the user's most-recently-running batch. Triggers
 * the same pauseBatchOnCreditExhaustion logic the worker would in
 * production — flips all the user's running batches to "paused",
 * sets pause_reason, etc.
 *
 * Lets you test the full pause/resume cycle in one click without
 * actually breaking a provider integration or burning credit.
 *
 * Admin-only (same gate as /settings/billing) so it can't be triggered
 * by a regular allowlisted user.
 *
 * Body:
 *   {
 *     "provider": "together" | "replicate"  // default "together"
 *   }
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { provider?: string };
  try {
    body = await req.json().catch(() => ({} as { provider?: string }));
  } catch {
    body = {};
  }
  const provider = body.provider === "replicate" ? "replicate" : "together";

  const supabase = getSupabase();
  // Find their most recently-created running batch — that's the most
  // likely target the user wants to test against.
  const { data: latest } = await supabase
    .from("job_batches")
    .select("id, label, total_jobs, done_jobs")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return NextResponse.json(
      {
        error:
          "No running batch found. Start a small bulk import first, then call this endpoint while it's processing.",
      },
      { status: 404 }
    );
  }

  await pauseBatchOnCreditExhaustion(
    latest.id as string,
    `[SIMULATED] ${provider} credit exhaustion test fired manually. Click Resume in the UI to clear.`
  );

  return NextResponse.json({
    paused_batch: {
      id: latest.id,
      label: latest.label,
      progress: `${latest.done_jobs}/${latest.total_jobs}`,
    },
    note: "Open /import/status/<batch_id> to see the pause banner + resume button. The /api/jobs/batches/active endpoint should also exclude this batch from now until you resume.",
  });
}
