import { requireUserId } from "./auth";
import { getSupabase, isSupabaseConfigured } from "./supabase-server";
import type { CreatorProfile } from "./profile";

/**
 * Fetch the signed-in user's creator profile, if Supabase + Clerk are
 * configured AND the user is signed in. Returns null silently otherwise —
 * the strategist works without a profile.
 */
export async function fetchProfile(): Promise<CreatorProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const userId = await requireUserId();
  if (!userId) return null;

  try {
    const { data } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as CreatorProfile) ?? null;
  } catch {
    return null;
  }
}
