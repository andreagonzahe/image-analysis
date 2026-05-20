// Server-side helpers for the background job queue.
// The Vercel Cron worker reads pending jobs, claims them, runs them, and
// marks done/failed. The /import flow enqueues. UI polls /api/jobs/batch/[id]
// for progress.

import { getSupabase, isSupabaseConfigured } from "./supabase-server";

export type JobKind = "screen" | "prefilter" | "analyze_image";
export type JobStatus = "pending" | "processing" | "done" | "failed" | "skipped";

export type Job = {
  id: string;
  user_id: string;
  kind: JobKind;
  status: JobStatus;
  batch_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  priority: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  next_attempt_at: string | null;
};

export type BatchKind = "dropbox_import" | "bulk_analyze";
export type BatchStatus = "running" | "completed" | "cancelled" | "paused";

export type JobBatch = {
  id: string;
  user_id: string;
  kind: BatchKind;
  label: string | null;
  total_jobs: number;
  done_jobs: number;
  failed_jobs: number;
  status: BatchStatus;
  notify_email: string | null;
  notified_at: string | null;
  created_at: string;
  completed_at: string | null;
};

const MAX_ATTEMPTS = 3;

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured — jobs queue is unavailable.");
  }
  return getSupabase();
}

export async function createBatch(args: {
  user_id: string;
  kind: BatchKind;
  label?: string;
  notify_email?: string;
  total_jobs?: number;
}): Promise<JobBatch> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("job_batches")
    .insert({
      user_id: args.user_id,
      kind: args.kind,
      label: args.label ?? null,
      notify_email: args.notify_email ?? null,
      total_jobs: args.total_jobs ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not create batch: ${error.message}`);
  return data as JobBatch;
}

export async function enqueueJobs(
  jobs: Array<{
    user_id: string;
    kind: JobKind;
    batch_id?: string | null;
    input: Record<string, unknown>;
    priority?: number;
  }>
): Promise<void> {
  if (jobs.length === 0) return;
  const supabase = requireSupabase();
  const rows = jobs.map((j) => ({
    user_id: j.user_id,
    kind: j.kind,
    batch_id: j.batch_id ?? null,
    input: j.input,
    priority: j.priority ?? 0,
  }));
  const { error } = await supabase.from("jobs").insert(rows);
  if (error) throw new Error(`Could not enqueue jobs: ${error.message}`);
  if (jobs[0]?.batch_id) {
    // INCREMENT the batch's total count — earlier this assignment OVERWROTE
    // total_jobs which silently destroyed the count whenever a worker
    // enqueued a single follow-up (screen→prefilter, prefilter→analyze).
    // Read-then-write isn't atomic but the worst case is a tiny under-count
    // on concurrent inserts, far better than clobbering to "1".
    const batchId = jobs[0].batch_id;
    const { data: current } = await supabase
      .from("job_batches")
      .select("total_jobs")
      .eq("id", batchId)
      .maybeSingle();
    const newTotal = (current?.total_jobs ?? 0) + jobs.length;
    await supabase
      .from("job_batches")
      .update({ total_jobs: newTotal })
      .eq("id", batchId);
  }
}

// A job left in "processing" longer than this is presumed crashed (the
// worker died mid-execution) and gets reset to "pending" on the next claim.
// Worker maxDuration is 60s, so 5 min is generous — a real long-running job
// would have failed-out by now.
const STUCK_JOB_RESET_MS = 5 * 60 * 1000;

/**
 * Reset jobs that have been stuck in "processing" for too long back to
 * "pending" so the queue can re-claim them. Runs at the start of claimJobs
 * — keeps the queue self-healing across worker crashes / dev-server
 * restarts. Returns the number of jobs revived.
 */
export async function resetStuckJobs(): Promise<number> {
  const supabase = requireSupabase();
  const cutoff = new Date(Date.now() - STUCK_JOB_RESET_MS).toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "pending", started_at: null })
    .eq("status", "processing")
    .lt("started_at", cutoff)
    .select("id");
  if (error) {
    console.warn("[jobs] resetStuckJobs failed (non-fatal):", error.message);
    return 0;
  }
  const n = data?.length ?? 0;
  if (n > 0) console.log(`[jobs] revived ${n} stuck job(s)`);
  return n;
}

/**
 * Atomically claim up to `limit` pending jobs. Marks them processing and
 * returns the rows. Uses a single SQL update to avoid races between concurrent
 * cron invocations.
 */
export async function claimJobs(limit: number): Promise<Job[]> {
  const supabase = requireSupabase();

  // Self-heal: jobs left in "processing" from a crashed worker get
  // released back to "pending" before we look for new work.
  await resetStuckJobs();

  // Pull the IDs of the next batch of work, then update them in a single shot.
  // We do it in two steps because the Supabase JS client doesn't expose
  // `update ... returning *` with the where-in pattern cleanly.
  //
  // Previous implementation used `.or("next_attempt_at.is.null,next_attempt_at.lte.X")`
  // but that silently returned zero rows on Supabase JS v2 even when 150
  // pending jobs with NULL next_attempt_at existed. Filter in JS instead —
  // it's a few-row pass after the indexed SELECT, no measurable perf hit.
  const nowIso = new Date().toISOString();
  // Order: priority DESC, then created_at DESC (NEWEST first). Earlier we
  // claimed oldest-first which meant a user's current import was starved
  // when older half-failed batches still had pending jobs — they'd watch
  // 0/75 forever while the worker drained someone else's old batch. With
  // newest-first, the just-started import always drains in front.
  // Pull a list of currently-paused batches so we can exclude their jobs.
  // Tiny query, runs once per claim, hot-path-safe even at scale.
  const { data: pausedBatches } = await supabase
    .from("job_batches")
    .select("id")
    .eq("status", "paused");
  const pausedIds = new Set((pausedBatches ?? []).map((b) => b.id as string));

  const { data: candidates, error: selErr } = await supabase
    .from("jobs")
    .select("id, next_attempt_at, batch_id")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit * 8); // overfetch — backoff + paused-batch filter trim it down

  if (selErr) {
    console.warn("[jobs] claimJobs select error:", selErr.message);
    return [];
  }
  if (!candidates || candidates.length === 0) return [];

  // Drop jobs whose backoff hasn't expired, and jobs whose batch is paused.
  // Paused batches stay until the user resumes — we don't want to keep
  // burning attempts on jobs the user has chosen to halt for cost reasons.
  const ready = candidates.filter(
    (c) =>
      (!c.next_attempt_at || c.next_attempt_at <= nowIso) &&
      !(c.batch_id && pausedIds.has(c.batch_id as string))
  );
  if (ready.length === 0) return [];
  const ids = ready.slice(0, limit).map((c) => c.id);

  // DO NOT touch `attempts` in this UPDATE — earlier the code set it to null
  // as a "placeholder" which silently failed when attempts is NOT NULL, leaving
  // every claim attempt returning empty. The actual attempts++ happens in the
  // follow-up loop below.
  const { data: claimed, error: updErr } = await supabase
    .from("jobs")
    .update({
      status: "processing",
      started_at: nowIso,
    })
    .in("id", ids)
    .in("status", ["pending", "failed"]) // race guard: don't claim if another worker already grabbed it
    .select();

  if (updErr) {
    console.warn("[jobs] claimJobs update error:", updErr.message);
    return [];
  }
  if (!claimed) return [];

  // Increment attempts in a follow-up call (Supabase client doesn't support
  // increment in update().set() without a custom Postgres function — keeping it
  // simple).
  for (const c of claimed as Job[]) {
    await supabase
      .from("jobs")
      .update({ attempts: (c.attempts ?? 0) + 1 })
      .eq("id", c.id);
  }

  return claimed as Job[];
}

export async function markJobDone(jobId: string, output: Record<string, unknown>): Promise<void> {
  const supabase = requireSupabase();
  const completedAt = new Date().toISOString();
  const { data: job } = await supabase
    .from("jobs")
    .update({ status: "done", output, completed_at: completedAt, error_message: null })
    .eq("id", jobId)
    .select()
    .single();
  if (job?.batch_id) {
    await rollupBatch(job.batch_id);
  }
}

export async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  const supabase = requireSupabase();

  // Fetch current attempts to decide retry vs final-fail
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) return;

  const attempts = (job.attempts as number) ?? 0;
  const isFinal = attempts >= MAX_ATTEMPTS;

  if (isFinal) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: errorMessage.slice(0, 1000),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (job.batch_id) await rollupBatch(job.batch_id);
  } else {
    // Re-queue with exponential backoff (5s, 25s, 125s)
    const delaySeconds = Math.pow(5, attempts);
    const nextAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    await supabase
      .from("jobs")
      .update({
        status: "pending",
        error_message: errorMessage.slice(0, 1000),
        next_attempt_at: nextAt,
      })
      .eq("id", jobId);
  }
}

export async function markJobSkipped(jobId: string, reason: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: job } = await supabase
    .from("jobs")
    .update({
      status: "skipped",
      output: { reason },
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select()
    .single();
  if (job?.batch_id) await rollupBatch(job.batch_id);
}

/**
 * Recompute a batch's progress counters and flip status if everything's done.
 */
export async function rollupBatch(batchId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("status")
    .eq("batch_id", batchId);
  if (!jobs) return;

  let done = 0;
  let failed = 0;
  let pending = 0;
  for (const j of jobs) {
    if (j.status === "done" || j.status === "skipped") done++;
    else if (j.status === "failed") failed++;
    else pending++;
  }

  const allDone = pending === 0;
  await supabase
    .from("job_batches")
    .update({
      done_jobs: done,
      failed_jobs: failed,
      total_jobs: jobs.length,
      status: allDone ? "completed" : "running",
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq("id", batchId);
}

export async function listBatchesForUser(userId: string, limit = 20): Promise<JobBatch[]> {
  const supabase = requireSupabase();
  const { data } = await supabase
    .from("job_batches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as JobBatch[];
}

export async function getBatch(batchId: string, userId: string): Promise<JobBatch | null> {
  const supabase = requireSupabase();
  const { data } = await supabase
    .from("job_batches")
    .select("*")
    .eq("id", batchId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as JobBatch) ?? null;
}

export async function listJobsForBatch(batchId: string, limit = 500): Promise<Job[]> {
  const supabase = requireSupabase();
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as Job[];
}

/**
 * Pause a batch and every other running batch belonging to the same
 * user. Triggered when the cron worker detects a credit-exhausted error
 * — better to halt the whole queue than bleed attempts across dozens of
 * jobs that will all fail the same way. The user resumes after topping
 * up; we reset their failed jobs' attempts to 0 in a separate action.
 */
export async function pauseBatchOnCreditExhaustion(
  batchId: string | null,
  reason: string
): Promise<void> {
  if (!batchId) return;
  const supabase = requireSupabase();
  const { data: batch } = await supabase
    .from("job_batches")
    .select("user_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch?.user_id) return;
  await supabase
    .from("job_batches")
    .update({
      status: "paused",
      pause_reason: reason.slice(0, 500),
      paused_at: new Date().toISOString(),
    })
    .eq("user_id", batch.user_id)
    .eq("status", "running");
}

/**
 * Resume every paused batch for this user and reset their failed jobs
 * back to pending so the worker re-claims them. Called when the user
 * clicks "Resume" after topping up.
 */
export async function resumePausedBatches(userId: string): Promise<number> {
  const supabase = requireSupabase();
  const { data: paused } = await supabase
    .from("job_batches")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "paused");
  const ids = (paused ?? []).map((b) => b.id as string);
  if (ids.length === 0) return 0;
  // Reset every failed/processing job in those batches.
  await supabase
    .from("jobs")
    .update({
      status: "pending",
      attempts: 0,
      started_at: null,
      next_attempt_at: null,
      error_message: null,
    })
    .in("batch_id", ids)
    .in("status", ["failed", "processing"]);
  await supabase
    .from("job_batches")
    .update({
      status: "running",
      pause_reason: null,
      paused_at: null,
    })
    .in("id", ids);
  return ids.length;
}
