import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, listFolder } from "@/lib/dropbox";

export const runtime = "nodejs";

/**
 * List immediate folder + image-file children of a Dropbox path. Used to
 * power the folder picker. Pass ?path=/ for root, ?path=/Photos for a sub.
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
  // Dropbox root is "" (empty string), subfolders are "/Path"
  const path = url.searchParams.get("path") ?? "";
  const dbPath = path === "/" ? "" : path;

  try {
    const folders: Array<{ id: string; name: string; path: string }> = [];
    const fileCount: { images: number; total: number } = { images: 0, total: 0 };
    let cursor: string | undefined;

    // Walk paginated; we want a full picture of this folder's children
    while (true) {
      const page = await listFolder(conn.access_token, dbPath, cursor);
      for (const e of page.entries) {
        fileCount.total++;
        if (e.tag === "folder") {
          folders.push({ id: e.id, name: e.name, path: e.path_display });
        } else if (/\.(jpg|jpeg|png|webp|heic|heif|gif|tiff|mp4|mov|webm)$/i.test(e.name)) {
          fileCount.images++;
        }
      }
      if (!page.has_more || !page.cursor) break;
      cursor = page.cursor;
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      path: path || "/",
      folders,
      counts: fileCount,
      account: {
        email: conn.account_email,
        name: conn.account_name,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
