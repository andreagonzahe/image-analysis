-- Track which Replicate predictions we've already asked the provider to
-- delete. The cleanup loop reads "provider='replicate' AND
-- provider_deleted_at IS NULL AND created_at < now() - 6min" and fires
-- DELETE /v1/predictions/<id> for each. (Replicate rejects deletes for
-- predictions younger than ~5 minutes, hence the 6-min gate.)

alter table public.usage_events
  add column if not exists provider_deleted_at timestamptz;

-- Speeds up the cleanup query (anti-condition + age window).
create index if not exists usage_events_cleanup_idx
  on public.usage_events (provider, created_at)
  where provider_deleted_at is null;
