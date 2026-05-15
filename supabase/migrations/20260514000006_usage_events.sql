-- Cost tracking. Every paid-API call (Replicate + Together) writes a row
-- here with the model identifier, token / runtime metrics, and the computed
-- USD cost. The billing dashboard aggregates from this table.
--
-- Keep schema flexible — pricing changes per provider so we store the raw
-- units (tokens / seconds) alongside the computed cost so we can re-derive
-- if rates move.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,                         -- nullable: cron jobs may not have a user
  created_at timestamptz not null default now(),
  provider text not null,               -- "replicate" | "together"
  model text not null,                  -- e.g. "meta-llama/Llama-3.3-70B-Instruct-Turbo"
  op text not null,                     -- "nsfw" | "captioner" | "prefilter" | "strategist" | "funnel-plan" | "rewrite-caption" | "retier"
  input_tokens int,                     -- Together: usage.prompt_tokens
  output_tokens int,                    -- Together: usage.completion_tokens
  runtime_ms int,                       -- Replicate: predict_time or wall clock
  cost_usd numeric(12, 8) not null,     -- computed at write time
  metadata jsonb                        -- free-form: prediction_id, hardware, retry_count, etc.
);

create index if not exists usage_events_user_created_idx
  on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_created_idx
  on public.usage_events(created_at desc);
create index if not exists usage_events_provider_idx
  on public.usage_events(provider, created_at desc);
