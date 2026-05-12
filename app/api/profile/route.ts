import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import type { CreatorProfile } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, profile: null });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: true, profile: data ?? null });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Partial<CreatorProfile>;
  try {
    body = (await req.json()) as Partial<CreatorProfile>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    niche: body.niche ?? null,
    niche_detail: body.niche_detail ?? null,
    tones: Array.isArray(body.tones) ? body.tones.slice(0, 5) : [],
    persona: body.persona ?? null,
    persona_detail: body.persona_detail ?? null,
    primary_platforms: Array.isArray(body.primary_platforms) ? body.primary_platforms.slice(0, 20) : [],
    audience_size: body.audience_size && typeof body.audience_size === "object" ? body.audience_size : null,
    updated_at: new Date().toISOString(),
  };
  if (body.survey_dismissed_at !== undefined) {
    row.survey_dismissed_at = body.survey_dismissed_at;
  }

  const { error } = await getSupabase().from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
