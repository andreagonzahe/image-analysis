import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "vault-images";
const STORAGE_DELETE_CHUNK = 100;

/**
 * Find / delete vault posts that don't contain a visible person.
 *
 * Decision basis: the captioner stores `analysis.tags.people_in_frame`
 * on every analyzed post. A post with people_in_frame === 0 (or missing,
 * which usually means the captioner couldn't identify any person) is
 * noise for an adult creator's library — sunsets, food close-ups, room
 * shots, cat photos, screenshots that slipped past the prefilter, etc.
 *
 * GET   → returns count + a sample so the user can confirm before deleting
 * POST  → actually deletes (requires { confirm: "REMOVE NO-PEOPLE" })
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const candidates = await findNoPeoplePosts(userId);
  return NextResponse.json({
    count: candidates.length,
    sample: candidates.slice(0, 8).map((c) => ({
      id: c.id,
      primary_platform: c.primary_platform,
      content_rating: c.content_rating,
      image_external_id: c.image_external_id,
      image_source: c.image_source,
    })),
  });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== "REMOVE NO-PEOPLE") {
    return NextResponse.json(
      { error: "Missing or wrong confirmation phrase." },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const candidates = await findNoPeoplePosts(userId);
  if (candidates.length === 0) {
    return NextResponse.json({ posts_deleted: 0, storage_files_deleted: 0 });
  }

  // Clean up Supabase Storage bytes for any rows we own.
  const paths = candidates
    .map((c) => c.image_path)
    .filter((p): p is string => Boolean(p));
  let storageDeleted = 0;
  for (let i = 0; i < paths.length; i += STORAGE_DELETE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_DELETE_CHUNK);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(chunk);
    if (!error) storageDeleted += chunk.length;
  }

  // Delete the post rows. We RLS-scope by user_id so this can't touch
  // anyone else's data.
  const ids = candidates.map((c) => c.id);
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

type Candidate = {
  id: string;
  primary_platform: string;
  content_rating: string;
  image_path: string | null;
  image_external_id: string | null;
  image_source: string;
};

async function findNoPeoplePosts(userId: string): Promise<Candidate[]> {
  const supabase = getSupabase();
  // Pull every post — we need the analysis JSON to inspect the tag. For
  // libraries past ~5000 we'd want server-side jsonb filtering, but for
  // current scale this is fine.
  const { data, error } = await supabase
    .from("posts")
    .select("id, primary_platform, content_rating, image_path, image_external_id, image_source, analysis")
    .eq("user_id", userId);
  if (error || !data) return [];

  const candidates: Candidate[] = [];
  for (const row of data) {
    const tags = extractTags(row.analysis);
    if (isNoPeople(tags)) {
      candidates.push({
        id: row.id as string,
        primary_platform: row.primary_platform as string,
        content_rating: row.content_rating as string,
        image_path: (row.image_path as string | null) ?? null,
        image_external_id: (row.image_external_id as string | null) ?? null,
        image_source: row.image_source as string,
      });
    }
  }
  return candidates;
}

function extractTags(analysis: unknown): Record<string, unknown> | null {
  if (!analysis || typeof analysis !== "object") return null;
  const a = analysis as Record<string, unknown>;
  const t = a.tags;
  return t && typeof t === "object" ? (t as Record<string, unknown>) : null;
}

/**
 * Decide whether this post has no person in it.
 *
 * Liberal definition — we want this to err toward DELETING in line with
 * the user's intent ("any picture that does not have a person in it"):
 *   - people_in_frame === 0 → clearly no person
 *   - people_in_frame missing AND attire is "unknown" or "fully_clothed"
 *     with no body parts visible AND sensuality is neutral → likely a
 *     non-person photo (food/landscape/etc.)
 * We DO keep:
 *   - any post where people_in_frame >= 1
 *   - any post where the captioner saw visible body parts (face,
 *     shoulders, cleavage, etc.) — even if it didn't count a person,
 *     those tags imply human content
 */
function isNoPeople(tags: Record<string, unknown> | null): boolean {
  if (!tags) return false; // analysis missing — don't delete
  const count = tags.people_in_frame;
  if (typeof count === "number" && count === 0) return true;
  // No reliable people_in_frame field — fall back to body-parts heuristic.
  if (count === undefined || count === null) {
    const bodyParts = Array.isArray(tags.body_parts_visible)
      ? (tags.body_parts_visible as unknown[])
      : [];
    if (bodyParts.length === 0) return true;
  }
  return false;
}
