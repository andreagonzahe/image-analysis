-- Per-user Dropbox OAuth connection. Stores the access + refresh tokens
-- needed to fetch files on behalf of the user. The access_token expires
-- (typically ~4 hours), the refresh_token is long-lived.
--
-- We store tokens in Supabase (server-only access via service_role key).
-- Clients never see these — all Dropbox API calls go through our /api/dropbox/*
-- endpoints which read from this table server-side.

create table if not exists public.dropbox_connections (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  account_id text,
  account_email text,
  account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dropbox_connections_email_idx on public.dropbox_connections (account_email);
