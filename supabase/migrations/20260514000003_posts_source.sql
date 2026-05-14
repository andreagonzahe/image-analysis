-- Allow vault posts to live in different places:
--   * supabase_storage (current default): image in our private bucket
--   * dropbox: image lives in the user's Dropbox; we re-sign temporary
--     URLs on-demand via the stored access token. No duplication of bytes.
--
-- This makes bulk imports practical — 8000 phone photos would otherwise
-- chew through Supabase's free 1GB Storage tier instantly.

alter table public.posts
  add column if not exists image_source text not null default 'supabase_storage',
  add column if not exists image_external_id text;

alter table public.posts drop constraint if exists posts_image_source_check;
alter table public.posts
  add constraint posts_image_source_check
  check (image_source in ('supabase_storage', 'dropbox'));

create index if not exists posts_image_source_idx on public.posts (image_source)
  where image_source <> 'supabase_storage';
