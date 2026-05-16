import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { resumePausedBatches } from "@/lib/jobs";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Resume every paused batch for the signed-in user. Resets failed jobs
 * inside those batches back to pending so the worker re-claims them.
 *
 * Triggered by the "Resume" button on the import status page after the
 * user has topped up their provider credit.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const resumedBatches = await resumePausedBatches(userId);
  return NextResponse.json({ resumed_batches: resumedBatches });
}
