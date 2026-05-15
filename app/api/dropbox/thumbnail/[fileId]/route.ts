import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, getThumbnailBytes } from "@/lib/dropbox";

export const runtime = "nodejs";

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
  // Dropbox file IDs start with "id:" — reject anything that doesn't look
  // like one so we don't accidentally make path-style requests.
  if (!fileId.startsWith("id:")) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sizeParam = url.searchParams.get("size") ?? "w640h480";
  const size = VALID_SIZES.has(sizeParam) ? sizeParam : "w640h480";

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

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      // Cache aggressively in the browser. Thumbnails for a given file-id +
      // size are effectively immutable for as long as the file exists.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
