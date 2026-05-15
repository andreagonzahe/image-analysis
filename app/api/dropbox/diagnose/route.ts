import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, getDropboxEnv } from "@/lib/dropbox";

export const runtime = "nodejs";

/**
 * Diagnostic — shows raw Dropbox API responses + which app key we're using.
 * Hit GET /api/dropbox/diagnose to see exactly what Dropbox is saying.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { appKey, redirectUri } = getDropboxEnv();
  const conn = await getConnectionForUser(userId);

  const result: Record<string, unknown> = {
    env: {
      app_key_prefix: appKey ? appKey.slice(0, 6) + "..." : "MISSING",
      app_key_length: appKey?.length ?? 0,
      redirect_uri: redirectUri,
    },
    connection: conn
      ? {
          account_email: conn.account_email,
          account_id: conn.account_id,
          token_prefix: conn.access_token.slice(0, 8) + "...",
          token_length: conn.access_token.length,
          expires_at: conn.expires_at,
          is_expired: new Date(conn.expires_at).getTime() < Date.now(),
          updated_at: conn.updated_at,
          age_minutes: Math.round((Date.now() - new Date(conn.updated_at).getTime()) / 60000),
        }
      : null,
  };

  if (!conn) {
    return NextResponse.json({ ...result, status: "no_connection" });
  }

  // Live test 1: account info (worked previously)
  try {
    const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    const text = await r.text();
    result.account_info_test = {
      status: r.status,
      ok: r.ok,
      body: text.slice(0, 500),
    };
  } catch (err) {
    result.account_info_test = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Live test 2: list_folder root (the failing call)
  try {
    const r = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: "" }),
    });
    const text = await r.text();
    result.list_folder_test = {
      status: r.status,
      ok: r.ok,
      body: text.slice(0, 500),
    };
  } catch (err) {
    result.list_folder_test = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Live test 3: which scopes the token actually has
  // Dropbox's /check/user works with any valid token regardless of scope
  try {
    const r = await fetch("https://api.dropboxapi.com/2/check/user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "ping" }),
    });
    const text = await r.text();
    result.check_user_test = {
      status: r.status,
      ok: r.ok,
      body: text.slice(0, 200),
    };
  } catch (err) {
    result.check_user_test = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(result, {
    headers: { "Content-Type": "application/json" },
  });
}
