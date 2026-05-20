import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, getThumbnailBytes } from "@/lib/dropbox";

export const runtime = "nodejs";

// In-memory LRU cache. Dropbox thumbnails are immutable per file_id +
// size, so once we've fetched the bytes once we can serve subsequent
// requests in ~5ms instead of ~500ms. Works locally (single Node
// process) — on Vercel the cache lives per warm function instance, so
// it still helps repeat views within a session.
const THUMB_CACHE = new Map<
  string,
  { bytes: Buffer; contentType: string; expires: number }
>();
const THUMB_CACHE_MAX = 500;
const THUMB_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — thumbnails are stable

function cacheGet(key: string): { bytes: Buffer; contentType: string } | null {
  const e = THUMB_CACHE.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    THUMB_CACHE.delete(key);
    return null;
  }
  // Touch (move to most-recently-used by re-inserting).
  THUMB_CACHE.delete(key);
  THUMB_CACHE.set(key, e);
  return { bytes: e.bytes, contentType: e.contentType };
}

function cacheSet(key: string, bytes: Buffer, contentType: string) {
  if (THUMB_CACHE.size >= THUMB_CACHE_MAX) {
    // Evict oldest (first inserted).
    const oldestKey = THUMB_CACHE.keys().next().value;
    if (oldestKey) THUMB_CACHE.delete(oldestKey);
  }
  THUMB_CACHE.set(key, { bytes, contentType, expires: Date.now() + THUMB_CACHE_TTL_MS });
}

// Format: literal "id:" prefix + 16-64 chars of base64-url-ish payload.
// Conservative cap on length so a malicious caller can't smuggle a giant
// request body through the URL. Dropbox real ids are typically 22 chars.
const FILE_ID_RE = /^id:[A-Za-z0-9_=\-]{8,64}$/;

const VALID_SIZES = new Set([
  "w32h32",
  "w64h64",
  "w128h128",
  "w256h256",
  "w480h320",
  "w640h480",
  "w960h640",
  "w1024h768",
  "w2048h1536",
]);

/**
 * Thumbnail proxy for Dropbox files. Browsers can't render HEIC / HEIF /
 * RAW formats served directly from Dropbox temp links — they show a broken
 * image. This endpoint asks Dropbox for a JPEG thumbnail (server-side
 * conversion) and streams it back to the browser as image bytes.
 *
 * URL:   /api/dropbox/thumbnail/<file-id>?size=w640h480
 * Auth:  required (uses the signed-in user's Dropbox connection)
 * Cache: 1 hour browser cache; thumbnail content is effectively immutable
 *        per file-id.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const { fileId: rawFileId } = await params;
  const fileId = decodeURIComponent(rawFileId);
  // Dropbox file IDs have a known shape: "id:" + 22ish chars of
  // base64-ish (letters/digits/_-=). Reject anything else so a malicious
  // caller can't smuggle paths, traversal, or extra Dropbox API args
  // through the URL.
  if (!FILE_ID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sizeParam = url.searchParams.get("size") ?? "w640h480";
  const size = VALID_SIZES.has(sizeParam) ? sizeParam : "w640h480";

  // Try the server-side cache first — keyed by user + file + size so two
  // users can't see each other's thumbnails (auth boundary intact).
  const cacheKey = `${userId}:${fileId}:${size}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.bytes), {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Cache": "HIT",
      },
    });
  }

  const conn = await getConnectionForUser(userId);
  if (!conn) {
    return NextResponse.json({ error: "Dropbox not connected" }, { status: 400 });
  }

  const result = await getThumbnailBytes(conn.access_token, fileId, size);
  if (!result) {
    return NextResponse.json(
      { error: "Could not fetch thumbnail" },
      { status: 502 }
    );
  }

  cacheSet(cacheKey, result.bytes, result.contentType);

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      // Cache aggressively in the browser. Thumbnails for a given file-id +
      // size are effectively immutable for as long as the file exists.
      "Cache-Control": "private, max-age=3600",
      "X-Cache": "MISS",
    },
  });
}
