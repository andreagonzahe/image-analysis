-- Extend profiles with the deeper personalization the framework needs:
--   * Content boundaries — what they DO shoot (filters offer recommendations)
--   * Strengths — what comes naturally (biases caption voice + content pillars)
--   * Time per week — realistic cadence
--   * Revenue target monthly — scales pricing recommendations
--   * Offer mix — which monetization modes they actually use or want to

alter table public.profiles
  add column if not exists boundaries_in text[] not null default '{}',
  add column if not exists strengths text[] not null default '{}',
  add column if not exists time_per_week text,
  add column if not exists revenue_target_monthly text,
  add column if not exists offer_mix text[] not null default '{}';
