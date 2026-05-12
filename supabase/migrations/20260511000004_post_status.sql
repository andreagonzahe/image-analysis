-- Project-management columns: track whether each vault entry has been posted,
-- when it was posted, when it's scheduled to be posted, and on which platform.
-- This turns the vault from a static list into a daily workflow tool.

alter table public.posts
  add column if not exists status text not null default 'pending',
  add column if not exists posted_at timestamptz,
  add column if not exists posted_on_platform text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists notes text;

-- Allowed values: 'pending' | 'scheduled' | 'posted' | 'skipped'
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts
  add constraint posts_status_check
  check (status in ('pending', 'scheduled', 'posted', 'skipped'));

create index if not exists posts_user_status_idx
  on public.posts (user_id, status, created_at desc);

create index if not exists posts_scheduled_idx
  on public.posts (user_id, scheduled_for)
  where scheduled_for is not null;
