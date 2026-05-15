import { auth as clerkAuth, clerkClient } from "@clerk/nextjs/server";

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Allowlist: when ALLOWED_EMAILS is set, only emails in the list can access
 * authenticated routes. This keeps the app internal-only — random signups
 * can complete in Clerk but get bounced before they can burn API tokens.
 *
 * Format: ALLOWED_EMAILS=me@example.com,coworker@example.com
 * Unset / empty → allowlist disabled (any signed-in user works).
 */
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistEnabled(): boolean {
  return getAllowedEmails().length > 0;
}

// userId → { allowed, email, expiresAt }. Avoids hitting Clerk on every API
// call. 10-min TTL is fine — if you change the allowlist, restart the server.
const allowedCache = new Map<string, { allowed: boolean; email: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getUserEmail(userId: string): Promise<string | null> {
  if (!CLERK_ENABLED) return null;
  const cached = allowedCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.primaryEmailAddress?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export async function isUserAllowed(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return true; // allowlist disabled

  const cached = allowedCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  const email = await getUserEmail(userId);
  const ok = email ? allowed.includes(email.toLowerCase()) : false;
  allowedCache.set(userId, {
    allowed: ok,
    email,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return ok;
}

/**
 * Returns the signed-in user's Clerk ID — but only if they pass the
 * allowlist (when one is configured). Non-allowlisted users get null so
 * routes naturally 401 just like anonymous requests.
 */
export async function requireUserId(): Promise<string | null> {
  if (!CLERK_ENABLED) return null;
  try {
    const { userId } = await clerkAuth();
    if (!userId) return null;
    if (!(await isUserAllowed(userId))) return null;
    return userId;
  } catch {
    return null;
  }
}

/**
 * Like requireUserId but doesn't enforce the allowlist. Use only for
 * routes that need to know "is this person logged in at all" without
 * gating access (e.g. the access-denied page itself).
 */
export async function getSignedInUserId(): Promise<string | null> {
  if (!CLERK_ENABLED) return null;
  try {
    const { userId } = await clerkAuth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export function isAuthEnabled(): boolean {
  return CLERK_ENABLED;
}

/**
 * Returns whether the user is an "admin" — currently the first email in
 * ALLOWED_EMAILS. Used to gate the billing dashboard.
 */
export async function isAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return true; // no allowlist → everyone is admin
  const email = (await getUserEmail(userId))?.toLowerCase() ?? "";
  return allowed[0] === email;
}
