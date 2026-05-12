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
    .select("id, created_at, analysis, content_rating, primary_platform, primary_price_low, primary_price_high, image_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as PostRow[];

  // Generate signed URLs in one batch for any rows that have an image_path.
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

  const posts = rows.map((r) => ({
    ...r,
    image_url: r.image_path ? urlByPath[r.image_path] ?? null : null,
  }));

  return NextResponse.json({ enabled: true, posts });
}
