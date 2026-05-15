import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "vault-images";
const STORAGE_DELETE_CHUNK = 100; // Supabase's storage.remove() takes up to ~1000 paths but chunk smaller for safety

/**
 * Nuke the user's entire vault: every post row, every Supabase Storage
 * image they own. Dropbox-sourced rows don't touch Dropbox itself —
 * those files stay safely in the user's Dropbox; we just stop
 * referencing them.
 *
 * UI requires a typed confirmation before calling this. There is no
 * undo. Returns a count of what was wiped.
 *
 * Body: { confirm: "DELETE EVERYTHING" }
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  // Confirmation gate — the UI sends the exact phrase. Server rejects
  // anything else so a casual POST can't accidentally wipe the vault.
  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== "DELETE EVERYTHING") {
    return NextResponse.json(
      { error: "Missing or wrong confirmation phrase." },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Collect storage paths for this user so we can remove the actual image
  // bytes too. We do this BEFORE deleting the rows.
  const { data: postsWithPaths } = await supabase
    .from("posts")
    .select("image_path")
    .eq("user_id", userId)
    .not("image_path", "is", null);
  const paths = (postsWithPaths ?? [])
    .map((p) => p.image_path as string)
    .filter(Boolean);

  let storageDeleted = 0;
  for (let i = 0; i < paths.length; i += STORAGE_DELETE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_DELETE_CHUNK);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(chunk);
    if (!error) storageDeleted += chunk.length;
  }

  // Delete every post row for this user. Count first so we can report.
  const { count: postsCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { error: postsErr } = await supabase
    .from("posts")
    .delete()
    .eq("user_id", userId);
  if (postsErr) {
    return NextResponse.json({ error: postsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    posts_deleted: postsCount ?? 0,
    storage_files_deleted: storageDeleted,
  });
}
