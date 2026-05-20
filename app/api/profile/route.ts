import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import type { CreatorProfile, BodyCategoryId, RoutingRules } from "@/lib/profile";
import { PLATFORM_IDS } from "@/lib/platforms";

export const runtime = "nodejs";

const BODY_CATEGORY_IDS: BodyCategoryId[] = [
  "tease", "boobs", "booty", "pussy", "full_nude", "modest",
];

/**
 * Pin routing-rule destinations to known platform ids. Anything weird
 * (unknown id, wrong type) gets dropped silently so a typo in the
 * incoming JSON doesn't leak garbage into the strategist prompt.
 */
function sanitizeRoutingRules(rules: unknown): RoutingRules {
  if (!rules || typeof rules !== "object") return {};
  const r = rules as Record<string, unknown>;
  const platforms = new Set(PLATFORM_IDS);
  const body_routing: Partial<Record<BodyCategoryId, string | null>> = {};
  const inputBody = r.body_routing && typeof r.body_routing === "object"
    ? (r.body_routing as Record<string, unknown>)
    : {};
  for (const cat of BODY_CATEGORY_IDS) {
    const dest = inputBody[cat];
    if (typeof dest === "string" && dest.length > 0 && platforms.has(dest)) {
      body_routing[cat] = dest;
    } else if (dest === null) {
      body_routing[cat] = null;
    }
  }
  const videoRaw = r.video_destination;
  const video_destination =
    typeof videoRaw === "string" && videoRaw.length > 0 && platforms.has(videoRaw)
      ? videoRaw
      : null;
  return { body_routing, video_destination };
}

function sanitizePriceUsd(value: unknown): number | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > 1000) return null;
  return n;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, profile: null });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: true, profile: data ?? null });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Partial<CreatorProfile>;
  try {
    body = (await req.json()) as Partial<CreatorProfile>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Sanitize routing_rules and price bounds.
  const sanitizedRouting = sanitizeRoutingRules(body.routing_rules);
  const priceFloor = sanitizePriceUsd(body.price_floor_usd);
  const priceCeiling = sanitizePriceUsd(body.price_ceiling_usd);

  const row: Record<string, unknown> = {
    user_id: userId,
    niche: body.niche ?? null,
    niche_detail: body.niche_detail ?? null,
    tones: Array.isArray(body.tones) ? body.tones.slice(0, 5) : [],
    persona: body.persona ?? null,
    persona_detail: body.persona_detail ?? null,
    primary_platforms: Array.isArray(body.primary_platforms) ? body.primary_platforms.slice(0, 20) : [],
    audience_size: body.audience_size && typeof body.audience_size === "object" ? body.audience_size : null,
    boundaries_in: Array.isArray(body.boundaries_in) ? body.boundaries_in.slice(0, 20) : [],
    strengths: Array.isArray(body.strengths) ? body.strengths.slice(0, 6) : [],
    time_per_week: body.time_per_week ?? null,
    revenue_target_monthly: body.revenue_target_monthly ?? null,
    offer_mix: Array.isArray(body.offer_mix) ? body.offer_mix.slice(0, 15) : [],
    of_account_mode:
      body.of_account_mode === "single" || body.of_account_mode === "free_paid_pair"
        ? body.of_account_mode
        : null,
    fansly_account_mode:
      body.fansly_account_mode === "single" || body.fansly_account_mode === "free_paid_pair"
        ? body.fansly_account_mode
        : null,
    routing_rules: sanitizedRouting,
    price_floor_usd: priceFloor,
    price_ceiling_usd: priceCeiling,
    updated_at: new Date().toISOString(),
  };
  if (body.survey_dismissed_at !== undefined) {
    row.survey_dismissed_at = body.survey_dismissed_at;
  }

  const { error } = await getSupabase().from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
