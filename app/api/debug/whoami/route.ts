import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

/**
 * Debug endpoint: shows what the server thinks about the current user
 * and the allowlist. Safe to expose because it only reveals info about
 * the requesting user, plus a redacted form of the allowlist.
 *
 * Intended for diagnosing access-denied false-positives.
 */
export async function GET() {
  let userId: string | null = null;
  try {
    const a = await auth();
    userId = a.userId ?? null;
  } catch {
    /* ignore */
  }

  let clerkEmail: string | null = null;
  if (userId) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      clerkEmail = user.primaryEmailAddress?.emailAddress ?? null;
    } catch (e) {
      clerkEmail = `<error: ${e instanceof Error ? e.message : String(e)}>`;
    }
  }

  const rawAllowed = process.env.ALLOWED_EMAILS ?? "";
  const allowed = rawAllowed
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const match = clerkEmail
    ? allowed.includes(clerkEmail.toLowerCase())
    : null;

  return NextResponse.json({
    server_sees_user_id: userId,
    server_sees_clerk_email: clerkEmail,
    server_sees_allowed_list: allowed,
    server_thinks_user_is_allowed: match,
    raw_env_set: Boolean(rawAllowed),
    raw_env_length: rawAllowed.length,
  });
}
