// Server-only Dropbox API client + OAuth helpers.
// Tokens live in the dropbox_connections table keyed by Clerk user_id.
// All calls auto-refresh the access_token when it's near expiry.

import { getSupabase, isSupabaseConfigured } from "./supabase-server";

export const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
export const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
export const DROPBOX_API = "https://api.dropboxapi.com/2";
export const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";

export type DropboxConnection = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: string | null;
  account_email: string | null;
  account_name: string | null;
  created_at: string;
  updated_at: string;
};

export type DropboxEntry = {
  tag: "file" | "folder";
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
};

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|heic|heif|gif|tiff)$/i;

/** Required environment variables for Dropbox OAuth. */
export function getDropboxEnv() {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const redirectUri = process.env.DROPBOX_REDIRECT_URI;
  return { appKey, appSecret, redirectUri };
}

export function isDropboxConfigured(): boolean {
  const { appKey, appSecret, redirectUri } = getDropboxEnv();
  return Boolean(appKey && appSecret && redirectUri);
}

/** Construct the URL we send the user to in order to grant us access. */
export function buildAuthorizeUrl(state: string): string {
  const { appKey, redirectUri } = getDropboxEnv();
  if (!appKey || !redirectUri) {
    throw new Error("Dropbox not configured");
  }
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    redirect_uri: redirectUri,
    token_access_type: "offline", // we need a refresh_token
    state,
    // Request the minimum scopes needed
    scope: "files.metadata.read files.content.read account_info.read",
  });
  return `${DROPBOX_AUTH_URL}?${params.toString()}`;
}

/** Exchange an auth code for tokens (call after Dropbox redirects back). */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  account_id: string;
}> {
  const { appKey, appSecret, redirectUri } = getDropboxEnv();
  if (!appKey || !appSecret || !redirectUri) throw new Error("Dropbox not configured");

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: appKey,
    client_secret: appSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Dropbox token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Refresh an expired access token using the refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const { appKey, appSecret } = getDropboxEnv();
  if (!appKey || !appSecret) throw new Error("Dropbox not configured");

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: appKey,
    client_secret: appSecret,
  });

  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Dropbox refresh failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Fetch the saved connection for a user, refreshing the access_token if expired. */
export async function getConnectionForUser(userId: string): Promise<DropboxConnection | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("dropbox_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const conn = data as DropboxConnection;

  // Refresh if expiring in the next 60s
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() < 60_000) {
    try {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from("dropbox_connections")
        .update({
          access_token: refreshed.access_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      conn.access_token = refreshed.access_token;
      conn.expires_at = newExpiresAt;
    } catch (err) {
      console.warn("Dropbox token refresh failed:", err);
    }
  }
  return conn;
}

/** Persist the freshly-acquired tokens after the OAuth callback. */
export async function saveConnection(args: {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  account_id?: string;
  account_email?: string;
  account_name?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const supabase = getSupabase();
  const expiresAt = new Date(Date.now() + args.expires_in * 1000).toISOString();
  const { error } = await supabase
    .from("dropbox_connections")
    .upsert(
      {
        user_id: args.user_id,
        access_token: args.access_token,
        refresh_token: args.refresh_token,
        expires_at: expiresAt,
        account_id: args.account_id ?? null,
        account_email: args.account_email ?? null,
        account_name: args.account_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`Could not save Dropbox connection: ${error.message}`);
}

export async function deleteConnection(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  await supabase.from("dropbox_connections").delete().eq("user_id", userId);
}

/** Fetch the connected account's metadata (email, name) once after OAuth. */
export async function fetchAccountInfo(accessToken: string): Promise<{
  account_id: string;
  email: string;
  display_name: string;
}> {
  const res = await fetch(`${DROPBOX_API}/users/get_current_account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Dropbox account fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return {
    account_id: data.account_id,
    email: data.email,
    display_name: data.name?.display_name ?? "",
  };
}

/** List entries in a Dropbox folder (just file/folder metadata). */
export async function listFolder(
  accessToken: string,
  path: string,
  cursor?: string
): Promise<{ entries: DropboxEntry[]; cursor: string | null; has_more: boolean }> {
  const url = cursor
    ? `${DROPBOX_API}/files/list_folder/continue`
    : `${DROPBOX_API}/files/list_folder`;
  const body = cursor
    ? { cursor }
    : {
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Dropbox list_folder failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const entries: DropboxEntry[] = (data.entries ?? []).map((e: Record<string, unknown>) => ({
    tag: e[".tag"] === "folder" ? "folder" : "file",
    id: String(e.id),
    name: String(e.name),
    path_lower: String(e.path_lower),
    path_display: String(e.path_display),
    size: e.size as number | undefined,
    client_modified: e.client_modified as string | undefined,
    server_modified: e.server_modified as string | undefined,
  }));
  return {
    entries,
    cursor: data.has_more ? data.cursor : null,
    has_more: Boolean(data.has_more),
  };
}

/** Recursively walk a folder and return all image files inside (paginated under the hood). */
export async function listAllImages(
  accessToken: string,
  rootPath: string,
  maxEntries = 10000
): Promise<DropboxEntry[]> {
  const out: DropboxEntry[] = [];
  let cursor: string | undefined;
  let path: string | undefined = rootPath;
  const folderQueue: string[] = [];

  while (out.length < maxEntries) {
    const page = await listFolder(accessToken, path ?? "", cursor);
    for (const e of page.entries) {
      if (e.tag === "folder") {
        folderQueue.push(e.path_lower);
      } else if (IMAGE_EXTENSIONS.test(e.name)) {
        out.push(e);
        if (out.length >= maxEntries) break;
      }
    }
    if (page.has_more && page.cursor) {
      cursor = page.cursor;
      path = undefined; // continue endpoint doesn't take path
    } else if (folderQueue.length > 0) {
      cursor = undefined;
      path = folderQueue.shift();
    } else {
      break;
    }
  }
  return out;
}

/** Download a file's bytes. */
export async function downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
  const res = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: fileId }),
    },
  });
  if (!res.ok) {
    throw new Error(`Dropbox download failed (${res.status}): ${await res.text()}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** Return a short-lived temporary direct download URL for a file. */
export async function getTemporaryLink(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`${DROPBOX_API}/files/get_temporary_link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: fileId }),
  });
  if (!res.ok) {
    throw new Error(`Dropbox temporary_link failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.link as string;
}
