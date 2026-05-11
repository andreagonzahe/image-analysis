import { auth as clerkAuth } from "@clerk/nextjs/server";

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export async function requireUserId(): Promise<string | null> {
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
