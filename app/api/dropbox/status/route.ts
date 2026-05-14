import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnectionForUser, isDropboxConfigured } from "@/lib/dropbox";

export const runtime = "nodejs";

export async function GET() {
  const configured = isDropboxConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ configured: true, connected: false, signed_in: false });
  }
  const conn = await getConnectionForUser(userId);
  return NextResponse.json({
    configured: true,
    signed_in: true,
    connected: Boolean(conn),
    account: conn ? { email: conn.account_email, name: conn.account_name } : null,
  });
}
