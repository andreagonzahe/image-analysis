-- Store a perceptual hash on every vault post so the "screen" pre-pass
-- can dedup new imports against the existing vault — not just against
-- earlier images in the same batch.
--
-- Without this column, a user who re-imports the same Dropbox folder
-- ends up with duplicate posts for every shot, because runScreen only
-- compared against jobs.output.phash from the current batch.
--
-- The column is a hex string (16 chars = 64-bit pHash). Nullable for
-- posts created before this migration; the retroactive scanner
-- backfills it as it walks the vault.

alter table public.posts
  add column if not exists phash text;

-- Per-user lookup index for the cross-batch dedup query in runScreen.
-- Partial index so we don't waste pages on un-backfilled rows.
create index if not exists posts_user_phash_idx
  on public.posts (user_id, phash)
  where phash is not null;
