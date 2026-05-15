import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "vault-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

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

  // 2. Dropbox-sourced rows: route through the thumbnail proxy. The browser
  // can't render HEIC / HEIF / RAW served directly from Dropbox temp links;
  // /api/dropbox/thumbnail/<file-id> asks Dropbox for a JPEG thumbnail
  // server-side and streams it back. No upfront fetching needed — the URL
  // resolves lazily when the <img> requests it.
  const posts = rows.map((r) => ({
    ...r,
    image_url:
      r.image_source === "dropbox" && r.image_external_id
        ? `/api/dropbox/thumbnail/${encodeURIComponent(r.image_external_id)}?size=w640h480`
        : r.image_path
          ? urlByPath[r.image_path] ?? null
          : null,
  }));

  return NextResponse.json({ enabled: true, posts });
}
