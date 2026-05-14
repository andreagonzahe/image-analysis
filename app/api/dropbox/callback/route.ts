import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { exchangeCodeForTokens, fetchAccountInfo, saveConnection } from "@/lib/dropbox";

export const runtime = "nodejs";

/** Dropbox redirects here after the user grants (or denies) consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectWithMessage(url, `Dropbox denied: ${error}`, false);
  }
  if (!code || !state) {
    return redirectWithMessage(url, "Dropbox callback was missing code or state.", false);
  }

  const userId = await requireUserId();
  if (!userId) {
    return redirectWithMessage(url, "You need to be signed in to connect Dropbox.", false);
  }

  // Verify state matches the cookie + the signed-in user
  const cookieState = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((p) => p.startsWith("dropbox_oauth_state="))
    ?.split("=")[1];
  if (!cookieState || decodeURIComponent(cookieState) !== state) {
    return redirectWithMessage(url, "OAuth state mismatch — try connecting again.", false);
  }
  if (!state.startsWith(`${userId}:`)) {
    return redirectWithMessage(url, "OAuth state doesn't match your account.", false);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    let accountInfo: { account_id?: string; email?: string; display_name?: string } = {};
    try {
      accountInfo = await fetchAccountInfo(tokens.access_token);
    } catch {
      // not fatal — we'll just save without the metadata
    }
    await saveConnection({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      account_id: accountInfo.account_id,
      account_email: accountInfo.email,
      account_name: accountInfo.display_name,
    });
    return redirectWithMessage(url, "Dropbox connected.", true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectWithMessage(url, message, false);
  }
}

function redirectWithMessage(url: URL, message: string, ok: boolean): NextResponse {
  const dest = new URL("/import", url);
  dest.searchParams.set(ok ? "dropbox_connected" : "dropbox_error", "1");
  if (!ok) dest.searchParams.set("message", message);
  const res = NextResponse.redirect(dest);
  // Clear the OAuth state cookie
  res.cookies.set("dropbox_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
