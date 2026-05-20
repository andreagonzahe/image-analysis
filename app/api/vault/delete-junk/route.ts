import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "vault-images";
const STORAGE_DELETE_CHUNK = 100;
const MAX_IDS_PER_REQUEST = 5000;

/**
 * Confirm + delete vault posts the scanner flagged as junk
 * (screenshots or duplicates). Idempotent — passing already-deleted
 * ids is a no-op.
 *
 * Body: { post_ids: string[], confirm: "REMOVE JUNK" }
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: { post_ids?: string[]; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== "REMOVE JUNK") {
    return NextResponse.json(
      { error: "Missing or wrong confirmation phrase." },
      { status: 400 }
    );
  }
  const ids = Array.isArray(body.post_ids)
    ? body.post_ids.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ posts_deleted: 0, storage_files_deleted: 0 });
  }
  if (ids.length > MAX_IDS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many ids in one request — max ${MAX_IDS_PER_REQUEST}` },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Look up storage paths so we can delete the actual image bytes from
  // Supabase Storage too. Only matters for direct-upload posts; Dropbox-
  // source posts have null image_path and their bytes stay in Dropbox.
  const { data: rows } = await supabase
    .from("posts")
    .select("id, image_path")
    .in("id", ids)
    .eq("user_id", userId);
  const paths = (rows ?? [])
    .map((r) => r.image_path as string | null)
    .filter((p): p is string => Boolean(p));

  let storageDeleted = 0;
  for (let i = 0; i < paths.length; i += STORAGE_DELETE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_DELETE_CHUNK);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(chunk);
    if (!error) storageDeleted += chunk.length;
  }

  const { error: delErr } = await supabase
    .from("posts")
    .delete()
    .in("id", ids)
    .eq("user_id", userId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    posts_deleted: ids.length,
    storage_files_deleted: storageDeleted,
  });
}
