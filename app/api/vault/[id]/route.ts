import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "vault-images";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const supabase = getSupabase();

  // Look up the image_path so we can delete the Storage object too.
  const { data: existing } = await supabase
    .from("posts")
    .select("image_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing?.image_path) {
    // Best-effort cleanup — don't fail the delete if Storage hiccups.
    await supabase.storage.from(BUCKET).remove([existing.image_path]).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
