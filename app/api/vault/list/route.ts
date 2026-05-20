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
  source_folder: string | null;
  phash: string | null;
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
    .select("id, created_at, analysis, content_rating, primary_platform, primary_price_low, primary_price_high, image_path, image_source, image_external_id, source_folder, phash, status, posted_at, posted_on_platform, scheduled_for, notes")
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

  // 2. Slim the analysis JSON down to only what the consuming pages use.
  // The full strategist output is ~5-10KB per post; across 500 posts that's
  // 3-5 MB the browser has to download + parse before /vault is
  // interactive. Most of that is raw_description, tags, do_not_post, and
  // nsfw_verdict — none of which the list views render. Strip them.
  //
  // Kept (used by /today and /vault):
  //   primary_recommendation, alternatives, funnel_strategy,
  //   image_summary, content_rating, content_tier
  // Stripped:
  //   raw_description, tags, do_not_post, nsfw_verdict
  type SlimAnalysis = {
    content_rating?: string;
    content_tier?: number;
    image_summary?: string;
    primary_recommendation?: unknown;
    alternatives?: unknown;
    funnel_strategy?: unknown;
    // Just the fields needed for the body-part category filter in the
    // vault UI. The full tags object is still in the DB; this is the
    // minimal subset we ship over the wire.
    tags?: {
      attire?: string;
      body_parts_visible?: string[];
      sensuality?: string;
      pose_intent?: string;
      scene?: string;
    };
  };
  const slim = (a: unknown): SlimAnalysis => {
    if (!a || typeof a !== "object") return {};
    const x = a as Record<string, unknown>;
    const tagsIn = x.tags && typeof x.tags === "object" ? (x.tags as Record<string, unknown>) : null;
    return {
      content_rating: typeof x.content_rating === "string" ? x.content_rating : undefined,
      content_tier: typeof x.content_tier === "number" ? x.content_tier : undefined,
      image_summary: typeof x.image_summary === "string" ? x.image_summary : undefined,
      primary_recommendation: x.primary_recommendation,
      alternatives: x.alternatives,
      funnel_strategy: x.funnel_strategy,
      tags: tagsIn
        ? {
            attire: typeof tagsIn.attire === "string" ? tagsIn.attire : undefined,
            body_parts_visible: Array.isArray(tagsIn.body_parts_visible)
              ? (tagsIn.body_parts_visible as string[])
              : undefined,
            sensuality: typeof tagsIn.sensuality === "string" ? tagsIn.sensuality : undefined,
            pose_intent: typeof tagsIn.pose_intent === "string" ? tagsIn.pose_intent : undefined,
            scene: typeof tagsIn.scene === "string" ? tagsIn.scene : undefined,
          }
        : undefined,
    };
  };

  // 3. Dropbox-sourced rows: route through the thumbnail proxy. The browser
  // can't render HEIC / HEIF / RAW served directly from Dropbox temp links;
  // /api/dropbox/thumbnail/<file-id> asks Dropbox for a JPEG thumbnail
  // server-side and streams it back. The URL resolves lazily when the
  // <img> requests it. w256h256 is the right size for the vault grid.
  const posts = rows.map((r) => ({
    ...r,
    analysis: slim(r.analysis),
    image_url:
      r.image_source === "dropbox" && r.image_external_id
        ? `/api/dropbox/thumbnail/${encodeURIComponent(r.image_external_id)}?size=w256h256`
        : r.image_path
          ? urlByPath[r.image_path] ?? null
          : null,
  }));

  return NextResponse.json({ enabled: true, posts });
}
