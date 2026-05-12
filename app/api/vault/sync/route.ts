import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

const BUCKET = "vault-images";

type SyncBody = {
  id: string;
  created_at: number; // ms epoch
  analysis: unknown;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
  image_data_url?: string; // optional — if provided, uploads to Storage
};

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // If an image was sent, upload it to Storage at {userId}/{postId}.jpg.
  let imagePath: string | null = null;
  if (body.image_data_url && body.image_data_url.startsWith("data:image/")) {
    try {
      const { blob, mime } = dataUrlToBlob(body.image_data_url);
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      imagePath = `${userId}/${body.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(imagePath, blob, {
          contentType: mime,
          upsert: true,
        });
      if (upErr) {
        console.warn("Image upload failed:", upErr.message);
        imagePath = null;
      }
    } catch (e) {
      console.warn("Image decode failed:", e);
      imagePath = null;
    }
  }

  const row: Record<string, unknown> = {
    id: body.id,
    user_id: userId,
    created_at: new Date(body.created_at).toISOString(),
    analysis: body.analysis,
    content_rating: body.content_rating,
    primary_platform: body.primary_platform,
    primary_price_low: body.primary_price_low,
    primary_price_high: body.primary_price_high,
  };
  if (imagePath) row.image_path = imagePath;

  const { error } = await supabase.from("posts").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, image_uploaded: Boolean(imagePath) });
}

function dataUrlToBlob(dataUrl: string): { blob: Buffer; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const b64 = match[2];
  return { blob: Buffer.from(b64, "base64"), mime };
}
