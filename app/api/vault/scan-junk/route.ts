import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import { getConnectionForUser, getThumbnailBytes } from "@/lib/dropbox";
import {
  computeFingerprint,
  hammingDistance,
  HAMMING_THRESHOLD,
  phashToString,
} from "@/lib/image-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vault retroactive junk scanner. Finds two kinds of clutter in posts
 * the user already paid to analyze:
 *
 *   1. Screenshots — leaked past the earlier prefilter. Detected by
 *      keyword-matching the captioner's saved description against a list
 *      of screenshot/UI signals + a no-person fallback.
 *
 *   2. Near-duplicates — burst shots, slight pose variations. Detected
 *      by computing a perceptual hash from each post's Dropbox thumbnail
 *      and clustering by Hamming distance ≤ 8.
 *
 * Read-only. Returns groups + suggested deletions; the user confirms
 * via a separate POST /api/vault/delete-junk call.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from("posts")
    .select("id, created_at, analysis, image_source, image_external_id, image_path, primary_platform, phash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const posts = rows ?? [];

  // ───── 1. Screenshot detection ─────
  // Matches keywords in the captioner's raw_description + image_summary
  // against known screenshot/UI signals. Cheap, no thumbnail fetches needed.
  const screenshots: Array<{ id: string; reason: string; platform: string }> = [];
  for (const p of posts) {
    const reason = detectScreenshot(p.analysis);
    if (reason) {
      screenshots.push({
        id: p.id as string,
        reason,
        platform: p.primary_platform as string,
      });
    }
  }

  // ───── 2. Duplicate detection ─────
  // Compute pHash from the 256×256 Dropbox thumbnail for every dropbox-
  // source post. Skip non-Dropbox + already-flagged screenshots.
  const screenshotIds = new Set(screenshots.map((s) => s.id));
  const dropboxPosts = posts.filter(
    (p) =>
      p.image_source === "dropbox" &&
      p.image_external_id &&
      !screenshotIds.has(p.id as string)
  );

  const conn = await getConnectionForUser(userId);
  const fingerprints: Array<{ id: string; phash: bigint; created_at: number }> = [];

  // Posts that already have a stored phash from the screen pass — skip
  // re-fetching their thumbnail. Saves a lot of Dropbox bandwidth on
  // subsequent scans.
  for (const p of dropboxPosts) {
    const stored = p.phash as string | null;
    if (stored) {
      try {
        const { phashFromString } = await import("@/lib/image-fingerprint");
        fingerprints.push({
          id: p.id as string,
          phash: phashFromString(stored),
          created_at: new Date(p.created_at as string).getTime(),
        });
      } catch {
        // bad stored hash → fall through to recompute below
      }
    }
  }
  const alreadyHashed = new Set(fingerprints.map((f) => f.id));
  const needHash = dropboxPosts.filter((p) => !alreadyHashed.has(p.id as string));

  // For posts missing a phash (created before the column existed, or
  // direct-upload posts whose screen pass predates the threading work),
  // compute it from the Dropbox thumbnail AND backfill the row so the
  // next import can cross-batch dedup against it for free.
  const backfills: Array<{ id: string; phash: string }> = [];
  if (conn && needHash.length > 0) {
    const CHUNK = 16;
    for (let i = 0; i < needHash.length; i += CHUNK) {
      const batch = needHash.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          const fileId = p.image_external_id as string;
          const t = await getThumbnailBytes(conn.access_token, fileId, "w256h256");
          if (!t) return null;
          const fp = await computeFingerprint(t.bytes);
          if (!fp) return null;
          return {
            id: p.id as string,
            phash: fp.phash,
            phashStr: phashToString(fp.phash),
            created_at: new Date(p.created_at as string).getTime(),
          };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          fingerprints.push({
            id: r.value.id,
            phash: r.value.phash,
            created_at: r.value.created_at,
          });
          backfills.push({ id: r.value.id, phash: r.value.phashStr });
        }
      }
    }
  }

  // Persist backfilled phashes so future imports cross-batch-dedup
  // against them. Best-effort — errors don't fail the scan.
  if (backfills.length > 0) {
    await Promise.allSettled(
      backfills.map((b) =>
        supabase
          .from("posts")
          .update({ phash: b.phash })
          .eq("id", b.id)
          .eq("user_id", userId)
      )
    );
  }

  // Cluster by Hamming distance. Simple O(n²) — n is hundreds-to-thousands,
  // fine for a one-off retroactive sweep.
  type Cluster = { keep_id: string; remove_ids: string[]; size: number };
  const seen = new Set<string>();
  const duplicateClusters: Cluster[] = [];
  for (let i = 0; i < fingerprints.length; i++) {
    if (seen.has(fingerprints[i].id)) continue;
    const cluster = [fingerprints[i]];
    for (let j = i + 1; j < fingerprints.length; j++) {
      if (seen.has(fingerprints[j].id)) continue;
      if (
        hammingDistance(fingerprints[i].phash, fingerprints[j].phash) <=
        HAMMING_THRESHOLD
      ) {
        cluster.push(fingerprints[j]);
        seen.add(fingerprints[j].id);
      }
    }
    seen.add(fingerprints[i].id);
    if (cluster.length > 1) {
      // Keep the OLDEST in each cluster (likely the original; later ones
      // are usually retakes / duplicates). User can choose differently in UI.
      cluster.sort((a, b) => a.created_at - b.created_at);
      duplicateClusters.push({
        keep_id: cluster[0].id,
        remove_ids: cluster.slice(1).map((c) => c.id),
        size: cluster.length,
      });
    }
  }

  const totalDuplicateRemovals = duplicateClusters.reduce(
    (sum, c) => sum + c.remove_ids.length,
    0
  );

  return NextResponse.json({
    total_scanned: posts.length,
    screenshots,
    screenshot_count: screenshots.length,
    duplicate_clusters: duplicateClusters,
    duplicate_remove_count: totalDuplicateRemovals,
    suggested_delete_count: screenshots.length + totalDuplicateRemovals,
  });
}

// Keywords the captioner uses when describing a screen capture. Hits
// app interfaces, real-estate listings, photo galleries, messaging
// apps, etc. — the noise patterns that leaked through prefilter.
const SCREENSHOT_KEYWORDS = [
  "screenshot",
  "screen capture",
  "screen grab",
  "phone screen",
  "smartphone screen",
  "app interface",
  "user interface",
  "UI element",
  "browser window",
  "web browser",
  "web page",
  "browser tab",
  "social media feed",
  "social media post",
  "instagram post",
  "twitter post",
  "facebook post",
  "tiktok video",
  "youtube video",
  "text message",
  "messaging app",
  "imessage",
  "whatsapp",
  "chat window",
  "chat conversation",
  "real estate listing",
  "real-estate listing",
  "property listing",
  "apartment listing",
  "photo gallery",
  "image gallery",
  "thumbnail grid",
  "thumbnails of",
  "grid of thumbnails",
  "settings menu",
  "settings page",
  "notification banner",
  "status bar",
  "address bar",
  "search bar",
  "keyboard on screen",
  "on-screen keyboard",
  "phone keyboard",
  "calendar view",
  "calendar event",
  "weather app",
  "map view",
  "google maps",
  "apple maps",
  "spreadsheet",
  "excel sheet",
  "document text",
  "pdf document",
  "receipt",
  "invoice",
  "code editor",
  "source code",
  "error message on screen",
  "error dialog",
];

function detectScreenshot(analysis: unknown): string | null {
  if (!analysis || typeof analysis !== "object") return null;
  const a = analysis as Record<string, unknown>;
  const desc = (typeof a.raw_description === "string" ? a.raw_description : "") +
    " " +
    (typeof a.image_summary === "string" ? a.image_summary : "");
  const lower = desc.toLowerCase();
  for (const k of SCREENSHOT_KEYWORDS) {
    if (lower.includes(k)) {
      return `screenshot indicator: "${k}"`;
    }
  }
  // Fallback: no people AND no body parts AND a scene that looks like
  // captured screen content (other / unknown).
  const tags = a.tags && typeof a.tags === "object" ? (a.tags as Record<string, unknown>) : null;
  if (tags) {
    const people = typeof tags.people_in_frame === "number" ? tags.people_in_frame : -1;
    const bodyParts = Array.isArray(tags.body_parts_visible) ? tags.body_parts_visible.length : 0;
    const scene = typeof tags.scene === "string" ? tags.scene : "";
    if (people === 0 && bodyParts === 0 && (scene === "other" || scene === "unknown")) {
      return "no person + ambiguous scene — likely non-photo content";
    }
  }
  return null;
}
