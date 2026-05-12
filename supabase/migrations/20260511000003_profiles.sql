-- Creator profile: niche, tone, persona, primary platforms, audience size.
-- Used to bias caption voice and funnel routing per user.
-- Keyed by Clerk user_id (this app does not use Supabase Auth).

create table if not exists public.profiles (
  user_id text primary key,
  niche text,                                -- short label (e.g. "lifestyle", "fitness", "adult-mainstream")
  niche_detail text,                         -- free-text refinement
  tones text[] not null default '{}',        -- pick 1-3 (e.g. ["playful","confident"])
  persona text,                              -- archetype label
  persona_detail text,                       -- free-text refinement
  primary_platforms text[] not null default '{}',  -- platform ids user actively posts on
  audience_size jsonb,                       -- { instagram: 5000, of: 200, ... }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_updated_idx on public.profiles (updated_at desc);
