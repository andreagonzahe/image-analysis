-- Auto-pause batches when we detect a provider out-of-credit error so we
-- don't bleed the rest of the queue's attempts into "failed" state. The
-- user resumes after topping up; we reset attempts and re-claim.

alter table public.job_batches
  drop constraint if exists job_batches_status_check;
alter table public.job_batches
  add constraint job_batches_status_check
  check (status in ('running', 'completed', 'cancelled', 'paused'));

alter table public.job_batches
  add column if not exists pause_reason text,
  add column if not exists paused_at timestamptz;
