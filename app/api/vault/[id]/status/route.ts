import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED_STATUS = new Set(["pending", "scheduled", "posted", "skipped"]);

type StatusBody = {
  status?: "pending" | "scheduled" | "posted" | "skipped";
  scheduled_for?: string | null; // ISO timestamp
  posted_on_platform?: string | null;
  notes?: string | null;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: StatusBody;
  try {
    body = (await req.json()) as StatusBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.status) {
    if (!ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "posted") {
      updates.posted_at = new Date().toISOString();
    } else if (body.status === "pending" || body.status === "skipped") {
      updates.posted_at = null;
    }
  }
  if (body.scheduled_for !== undefined) updates.scheduled_for = body.scheduled_for;
  if (body.posted_on_platform !== undefined) updates.posted_on_platform = body.posted_on_platform;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
