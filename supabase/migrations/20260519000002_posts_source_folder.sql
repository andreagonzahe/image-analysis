-- Folder grouping for the vault. Captures the parent folder of each
-- imported file so we can group posts by "shoot" (i.e. the user's own
-- Dropbox organization).
--
-- Convention:
--   * Dropbox-source posts: full parent path, e.g.
--     "/OF Content/2025-05-12 lingerie shoot". The UI shows just the
--     leaf when rendering folder cards.
--   * Direct-upload posts:  null. The UI groups these under
--     "Direct uploads."
--
-- Nullable so existing rows don't break. The retroactive
-- /api/vault/backfill-folders endpoint (separate) walks old posts and
-- fills this in via a Dropbox get_metadata call per file.

alter table public.posts
  add column if not exists source_folder text;

create index if not exists posts_user_source_folder_idx
  on public.posts (user_id, source_folder)
  where source_folder is not null;
