import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import { getConnectionForUser, getTemporaryLink } from "@/lib/dropbox";

export const runtime = "nodejs";

const BUCKET = "vault-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Dropbox temp links live 4 hours. We generate them in parallel with a soft
// limit so a 5000-item vault doesn't make ~5000 simultaneous Dropbox API
// calls. Anything past this gets a null url and won't render a preview;
// could be replaced with on-demand fetch later if needed.
const MAX_DROPBOX_PREVIEW_LINKS = 200;

type PostRow = {
  id: string;
  created_at: string;
  analysis: unknown;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
  image_path: string | null;
  image_source: "supabase_storage" | "dropbox";
  image_external_id: string | null;
  status: "pending" | "scheduled" | "posted" | "skipped";
  posted_at: string | null;
  posted_on_platform: string | null;
  scheduled_for: string | null;
  notes: string | null;
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, posts: [] });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, analysis, content_rating, primary_platform, primary_price_low, primary_price_high, image_path, image_source, image_external_id, status, posted_at, posted_on_platform, scheduled_for, notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as PostRow[];

  // 1. Supabase Storage rows: batch-sign in one call.
  const pathsToSign = rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
  const urlByPath: Record<string, string> = {};
  if (pathsToSign.length > 0) {
    const { data: signedData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS);
    if (signedData) {
      for (const s of signedData) {
        if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
      }
    }
  }

  // 2. Dropbox-sourced rows: get a temp link per file (parallel, capped).
  // The vault previously had no way to render Dropbox items because they
  // never get an image_path — now we fetch a 4hr temp URL on the fly.
  const dropboxRows = rows
    .filter((r) => r.image_source === "dropbox" && r.image_external_id)
    .slice(0, MAX_DROPBOX_PREVIEW_LINKS);
  const urlByFileId: Record<string, string> = {};
  if (dropboxRows.length > 0) {
    const conn = await getConnectionForUser(userId);
    if (conn) {
      const results = await Promise.allSettled(
        dropboxRows.map(async (r) => {
          const link = await getTemporaryLink(conn.access_token, r.image_external_id!);
          return { id: r.image_external_id!, link };
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.link) {
          urlByFileId[result.value.id] = result.value.link;
        }
      }
    }
  }

  const posts = rows.map((r) => ({
    ...r,
    image_url:
      r.image_source === "dropbox" && r.image_external_id
        ? urlByFileId[r.image_external_id] ?? null
        : r.image_path
          ? urlByPath[r.image_path] ?? null
          : null,
  }));

  return NextResponse.json({ enabled: true, posts });
}
