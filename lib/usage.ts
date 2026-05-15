import { getSupabase, isSupabaseConfigured } from "./supabase-server";

export type UsageOp =
  | "nsfw"
  | "captioner"
  | "prefilter"
  | "strategist"
  | "funnel-plan"
  | "rewrite-caption"
  | "retier";

export type UsageEvent = {
  user_id: string | null;
  provider: "replicate" | "together";
  model: string;
  op: UsageOp;
  input_tokens?: number | null;
  output_tokens?: number | null;
  runtime_ms?: number | null;
  cost_usd: number;
  metadata?: Record<string, unknown> | null;
};

/**
 * Fire-and-forget usage logger. Never throws — we don't want billing to
 * break the actual request if Supabase is down.
 */
export function recordUsage(event: UsageEvent): void {
  if (!isSupabaseConfigured()) return;
  // Defer to a microtask so the hot path doesn't wait on Supabase.
  void (async () => {
    try {
      await getSupabase()
        .from("usage_events")
        .insert({
          user_id: event.user_id,
          provider: event.provider,
          model: event.model,
          op: event.op,
          input_tokens: event.input_tokens ?? null,
          output_tokens: event.output_tokens ?? null,
          runtime_ms: event.runtime_ms ?? null,
          cost_usd: event.cost_usd,
          metadata: event.metadata ?? null,
        });
    } catch (err) {
      console.warn("[usage] recordUsage failed (non-fatal):", err);
    }
  })();
}
