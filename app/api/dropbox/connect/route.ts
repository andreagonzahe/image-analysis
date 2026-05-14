import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { buildAuthorizeUrl, isDropboxConfigured } from "@/lib/dropbox";

export const runtime = "nodejs";

/** Start the Dropbox OAuth flow. Redirects the user to Dropbox's consent page. */
export async function GET() {
  if (!isDropboxConfigured()) {
    return NextResponse.json(
      { error: "Dropbox is not configured. Set DROPBOX_APP_KEY, DROPBOX_APP_SECRET, and DROPBOX_REDIRECT_URI in .env.local." },
      { status: 500 }
    );
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  // Use the Clerk userId as part of the OAuth state for CSRF protection +
  // identity continuity. The callback verifies state matches the signed-in user.
  const stateNonce = crypto.randomUUID();
  const state = `${userId}:${stateNonce}`;
  const url = buildAuthorizeUrl(state);

  // Set the state nonce in an httpOnly cookie so the callback can verify it.
  const res = NextResponse.redirect(url);
  res.cookies.set("dropbox_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  return res;
}
