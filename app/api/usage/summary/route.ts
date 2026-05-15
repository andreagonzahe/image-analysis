import { NextResponse } from "next/server";
import { requireUserId, isAdminUser, isAuthEnabled } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Aggregated cost/usage summary for the billing dashboard.
 *
 * Returns:
 *   - today (current calendar day) — total cost + call count, per op
 *   - this_month (current calendar month) — same
 *   - last_30_days — daily series for chart
 *   - by_provider — breakdown for current month
 *   - by_op — breakdown for current month
 *   - recent — most recent 25 events
 */
export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ enabled: false, reason: "auth_disabled" }, { status: 200 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ enabled: false, reason: "supabase_missing" }, { status: 200 });
  }
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  // Billing is admin-only — surfaces every user's spend (which is YOUR cost).
  const admin = await isAdminUser(userId);
  if (!admin) {
    return NextResponse.json(
      { error: "Billing is restricted to admin." },
      { status: 403 }
    );
  }

  const supabase = getSupabase();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Pull last 30 days of events; aggregate in memory. For this volume
  // (<100k rows/month even in heavy use) it's faster than SQL aggregation
  // round-trips and lets us reuse one fetch.
  const { data: events, error } = await supabase
    .from("usage_events")
    .select("provider, model, op, cost_usd, created_at, input_tokens, output_tokens, runtime_ms, user_id")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = events ?? [];

  type Row = typeof rows[number];
  const sumCost = (xs: Row[]) => xs.reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
  const groupSum = <K extends string>(xs: Row[], key: (r: Row) => K) => {
    const out: Record<K, { cost: number; calls: number }> = {} as Record<
      K,
      { cost: number; calls: number }
    >;
    for (const r of xs) {
      const k = key(r);
      if (!out[k]) out[k] = { cost: 0, calls: 0 };
      out[k].cost += Number(r.cost_usd ?? 0);
      out[k].calls += 1;
    }
    return out;
  };

  const today = rows.filter((r) => new Date(r.created_at) >= startOfToday);
  const thisMonth = rows.filter((r) => new Date(r.created_at) >= startOfMonth);

  // Daily series for the last 30 days (oldest → newest)
  const daySeries: Array<{ date: string; cost: number; calls: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dayRows = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    daySeries.push({
      date: d.toISOString().slice(0, 10),
      cost: sumCost(dayRows),
      calls: dayRows.length,
    });
  }

  return NextResponse.json({
    enabled: true,
    today: { cost: sumCost(today), calls: today.length, by_op: groupSum(today, (r) => r.op) },
    this_month: {
      cost: sumCost(thisMonth),
      calls: thisMonth.length,
      by_op: groupSum(thisMonth, (r) => r.op),
      by_provider: groupSum(thisMonth, (r) => r.provider),
      by_model: groupSum(thisMonth, (r) => r.model),
    },
    last_30_days: daySeries,
    recent: rows.slice(0, 25),
    period: {
      start_of_today: startOfToday.toISOString(),
      start_of_month: startOfMonth.toISOString(),
    },
  });
}
