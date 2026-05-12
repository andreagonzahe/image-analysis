-- Initial schema for the Postwise vault sync.
-- Stores the analysis JSON keyed by Clerk user_id. Images are never stored
-- here — they live in the user's browser via IndexedDB.

create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  analysis jsonb not null,
  content_rating text not null,
  primary_platform text not null,
  primary_price_low int not null default -1,
  primary_price_high int not null default -1
);

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);
