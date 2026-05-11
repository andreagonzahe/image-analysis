import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

type SyncBody = {
  id: string;
  created_at: number; // ms epoch
  analysis: unknown;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
};

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("posts")
    .upsert(
      {
        id: body.id,
        user_id: userId,
        created_at: new Date(body.created_at).toISOString(),
        analysis: body.analysis,
        content_rating: body.content_rating,
        primary_platform: body.primary_platform,
        primary_price_low: body.primary_price_low,
        primary_price_high: body.primary_price_high,
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
