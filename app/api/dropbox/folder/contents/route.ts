import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, listAllImages } from "@/lib/dropbox";

export const runtime = "nodejs";

/**
 * Recursively count all image files inside a Dropbox folder.
 * Returns the IDs so the /api/import endpoint can enqueue them.
 *
 * For the cost forecast we just need the count + total size; for the actual
 * import we need each file's path/id.
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const conn = await getConnectionForUser(userId);
  if (!conn) {
    return NextResponse.json({ error: "Connect Dropbox first" }, { status: 400 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  const dbPath = path === "/" ? "" : path;
  // Raised cap: most users with large libraries hit the old 10k limit
  // silently. 50k handles ~99% of cases.
  const max = Math.min(Number(url.searchParams.get("max")) || 50000, 50000);

  try {
    const { files: entries, truncated } = await listAllImages(conn.access_token, dbPath, max);
    const totalBytes = entries.reduce((sum, e) => sum + (e.size ?? 0), 0);
    return NextResponse.json({
      path: path || "/",
      count: entries.length,
      total_bytes: totalBytes,
      truncated,
      max_scanned: max,
      files: entries.map((e) => ({
        id: e.id,
        name: e.name,
        path: e.path_display,
        size: e.size ?? 0,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
