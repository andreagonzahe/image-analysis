import { NextResponse } from "next/server";
import { requireUserId, isAuthEnabled } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  return NextResponse.json({
    auth_enabled: isAuthEnabled(),
    sync_enabled: isSupabaseConfigured(),
    signed_in: Boolean(userId),
  });
}
