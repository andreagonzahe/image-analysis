import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteConnection } from "@/lib/dropbox";

export const runtime = "nodejs";

/** Forget the saved Dropbox tokens for the signed-in user. */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  await deleteConnection(userId);
  return NextResponse.json({ ok: true });
}
