-- Background job queue for bulk-import + bulk-analysis flows.
-- One row per unit of work the background worker should process. The cron
-- endpoint pulls a batch of "pending" jobs, marks them "processing", does the
-- work, then marks "done" or "failed". Jobs are scoped to the Clerk user_id.
--
-- Kinds (initial set; more can be added as the system grows):
--   "prefilter"      — cheap classifier: is this a postable piece, yes/no
--   "analyze_image"  — the full NSFW + tagger + strategist pipeline
--
-- input/output are jsonb so different kinds can carry different payloads.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  -- Optional grouping so we can show "your import from Tuesday" as a unit
  batch_id uuid,
  -- The thing this job operates on. For prefilter / analyze_image: { source_url, source_id, source_label }.
  input jsonb not null default '{}'::jsonb,
  -- The result. For analyze_image, the analysis JSON. For prefilter, { keep: bool, reason: string }.
  output jsonb,
  -- For human-readable error display when status='failed'
  error_message text,
  attempts int not null default 0,
  -- For ordering / rate-limiting
  priority int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- For exponential backoff between retries
  next_attempt_at timestamptz
);

create index if not exists jobs_user_status_idx on public.jobs (user_id, status, created_at);
create index if not exists jobs_batch_idx on public.jobs (batch_id) where batch_id is not null;
create index if not exists jobs_worker_idx on public.jobs (status, next_attempt_at, priority desc, created_at)
  where status in ('pending', 'failed');

-- A "batch" row tracks the import-or-bulk-analysis as a unit so the UI can
-- show progress and the worker can email when the whole batch finishes.
create table if not exists public.job_batches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,                        -- e.g. "dropbox_import", "bulk_analyze"
  label text,                                -- "Import from /Photos/2026-Q2"
  total_jobs int not null default 0,
  done_jobs int not null default 0,
  failed_jobs int not null default 0,
  status text not null default 'running'
    check (status in ('running', 'completed', 'cancelled')),
  notify_email text,                         -- optional, for "done" notification
  notified_at timestamptz,                   -- so we only email once
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists job_batches_user_idx on public.job_batches (user_id, created_at desc);
create index if not exists job_batches_unfinished_idx on public.job_batches (status, completed_at)
  where status = 'running';
