"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type BatchStatus = {
  batch: {
    id: string;
    label: string;
    status: "running" | "completed" | "cancelled" | "paused";
    total_jobs: number;
    done_jobs: number;
    failed_jobs: number;
    created_at: string;
    completed_at: string | null;
    pause_reason?: string | null;
    paused_at?: string | null;
  };
  counts: Record<string, number>;
  by_kind: {
    prefilter: Record<string, number>;
    analyze_image: Record<string, number>;
  };
  recent_failures: Array<{ kind: string; error: string; name: string }>;
  recent_posts: Array<{
    id: string;
    content_rating: string;
    primary_platform: string;
    image_external_id: string | null;
    image_source: string;
    image_url: string | null;
  }>;
};

export default function StatusPageWrapper(props: { params: Promise<{ id: string }> }) {
  // Wrap in suspense so useSearchParams works during the static render pass.
  return <StatusPage {...props} />;
}

function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const skippedAsDuplicate = Number(searchParams.get("skipped") ?? 0);
  // Module-scope helpers were hoisted but somehow broke after a Turbopack
  // hot reload — keeping them inside the component closure avoids any
  // hoisting weirdness across HMR cycles.
  const formatEta = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return "almost done";
    if (seconds < 60) return `~${Math.round(seconds)} sec`;
    const min = seconds / 60;
    if (min < 60) {
      if (min < 2) return "~1 min";
      return `~${Math.round(min)} min`;
    }
    const hr = min / 60;
    return `~${Math.round(hr * 10) / 10} hr`;
  };
  const staticRange = (remaining: number): string => {
    const fastMin = (remaining * 1.5) / 60;
    const slowMin = (remaining * 1.28) / 5;
    const fmt = (m: number) => {
      if (m < 1) return "< 1 min";
      if (m < 60) return `${Math.round(m)} min`;
      return `${Math.round((m / 60) * 10) / 10} hr`;
    };
    return `${fmt(fastMin)}–${fmt(slowMin)}`;
  };
  const { id } = use(params);
  const [data, setData] = useState<BatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  const retryAll = async () => {
    setRetrying(true);
    setRetryMsg(null);
    try {
      const res = await fetch(`/api/jobs/batch/${id}/retry`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setRetryMsg(`Reset ${json.reset} job(s). They'll start processing again now.`);
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  const resumePaused = async () => {
    setRetrying(true);
    setRetryMsg(null);
    try {
      const res = await fetch("/api/jobs/resume", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resume failed");
      setRetryMsg(
        `Resumed ${json.resumed_batches} batch${json.resumed_batches === 1 ? "" : "es"}. Workers will start processing again in a few seconds.`
      );
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  const cancelOthers = async () => {
    setRetrying(true);
    setRetryMsg(null);
    try {
      const res = await fetch("/api/jobs/cancel-other-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      setRetryMsg(
        `Cancelled ${json.cancelled_batches} older batch${json.cancelled_batches === 1 ? "" : "es"} (${json.cancelled_jobs} jobs freed). The worker will now focus on this batch only.`
      );
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/jobs/batch/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not load status");
          return;
        }
        setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    fetchOnce();
    const id_ = setInterval(fetchOnce, 5000);
    return () => {
      cancelled = true;
      clearInterval(id_);
    };
  }, [id]);

  // Client-side cron trigger. In production Vercel Cron hits the worker
  // endpoint every minute. Locally there's nothing scheduling it, so the
  // queue would just sit pending. While this status page is open we
  // chain-fire ticks: as soon as one POST returns we kick off the next.
  // Each tick processes up to 5 jobs in parallel server-side, so a 75-job
  // batch typically drains in 2-4 minutes. Backs off to a 6s cooldown when
  // the queue is empty, so we don't hammer the endpoint after the import
  // finishes (the page might stay open for a while).
  useEffect(() => {
    if (!data) return;
    if (data.batch.status !== "running") return;

    let stopped = false;
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch("/api/cron/process-jobs", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (stopped) return;
        // If the queue is empty, slow down — wait 6s before checking again.
        // Otherwise loop immediately so we drain as fast as the worker can.
        const idle =
          body?.message === "No pending jobs." || (body?.processed ?? 0) === 0;
        cooldownTimer = setTimeout(tick, idle ? 6000 : 200);
      } catch {
        // Don't kill the loop on transient errors — try again in 6s.
        if (!stopped) cooldownTimer = setTimeout(tick, 6000);
      }
    };
    tick();
    return () => {
      stopped = true;
      if (cooldownTimer) clearTimeout(cooldownTimer);
    };
  }, [data?.batch.status, id]);

  if (error) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Import status</h1>
        </header>
        <div className="error-banner">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Import status</h1>
          <p className="hero-sub">Loading…</p>
        </header>
      </main>
    );
  }

  const isPaused = data.batch.status === "paused";
  const isDone = data.batch.status !== "running" && !isPaused;
  const total = data.batch.total_jobs;
  const done = data.batch.done_jobs;
  const failed = data.batch.failed_jobs;
  const remaining = Math.max(0, total - done - failed);
  const pct = total === 0 ? 0 : Math.round(((done + failed) / total) * 100);

  // ----- Live ETA -----
  // Throughput from when the batch started up to now. We only show the
  // dynamic estimate once at least a few jobs have completed — otherwise
  // a single fluke can produce a wildly wrong number. Before that, we
  // show the same range-based static estimate the /import page uses.
  const completedJobs = done + failed;
  const startedAt = new Date(data.batch.created_at).getTime();
  const elapsedSec = Math.max(1, (Date.now() - startedAt) / 1000);
  const throughput = completedJobs > 0 ? completedJobs / elapsedSec : 0; // jobs/sec
  let etaLabel = "";
  if (isDone) {
    etaLabel = "";
  } else if (completedJobs >= 3 && throughput > 0) {
    const etaSec = remaining / throughput;
    etaLabel = `${formatEta(etaSec)} remaining · ${(throughput * 60).toFixed(1)} jobs/min`;
  } else {
    // No data yet — fall back to a static range so the user has something.
    etaLabel = `Estimated ${staticRange(remaining)} total`;
  }

  // Split out the two passes
  const pre = data.by_kind.prefilter ?? {};
  const ana = data.by_kind.analyze_image ?? {};
  const preDone = (pre.done ?? 0) + (pre.skipped ?? 0);
  const preTotal = (pre.pending ?? 0) + (pre.processing ?? 0) + (pre.done ?? 0) + (pre.skipped ?? 0) + (pre.failed ?? 0);
  const anaDone = (ana.done ?? 0);
  const anaTotal = (ana.pending ?? 0) + (ana.processing ?? 0) + (ana.done ?? 0) + (ana.failed ?? 0);
  const kept = ana.done ?? 0;
  const skipped = pre.skipped ?? 0;

  return (
    <main>
      <header className="hero">
        <h1 className="title">
          {isPaused ? "⏸ Import paused" : isDone ? "Import complete" : "Importing…"}
        </h1>
        <p className="hero-sub">
          {isPaused
            ? `Paused at ${done}/${total} to avoid wasting more attempts. Top up your provider credit, then click Resume below.`
            : isDone
              ? `Finished. ${kept.toLocaleString()} pieces added to your vault, ${skipped.toLocaleString()} skipped as noise.`
              : `Working on "${data.batch.label}". You can close this tab — we'll keep going in the background.`}
        </p>
        {skippedAsDuplicate > 0 && (
          <p className="hero-sub" style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Skipped {skippedAsDuplicate.toLocaleString()} photo{skippedAsDuplicate === 1 ? "" : "s"} already in your vault.
          </p>
        )}
      </header>

      {isPaused && (
        <div className="paused-banner">
          <div>
            <strong className="paused-banner-title">⚠ Out of API credit</strong>
            <p className="paused-banner-body">
              {data.batch.pause_reason ?? "A provider returned a credit-exhausted error and the queue was paused to stop burning attempts on jobs that would all fail."}
            </p>
            <p className="paused-banner-body" style={{ marginTop: 6 }}>
              Top up at{" "}
              <a href="https://api.together.ai/settings/billing" target="_blank" rel="noopener">together.ai/settings/billing</a>{" "}
              and/or{" "}
              <a href="https://replicate.com/account/billing" target="_blank" rel="noopener">replicate.com/account/billing</a>
              , then click Resume.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={resumePaused}
            disabled={retrying}
          >
            {retrying ? "Resuming…" : "Resume import"}
          </button>
        </div>
      )}

      <div className="card status-overall">
        <div className="progress-bar" style={{ height: 12 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="status-overall-meta">
          <span>{(done + failed).toLocaleString()} / {total.toLocaleString()} jobs</span>
          <span>{pct}%</span>
          <span>{remaining.toLocaleString()} remaining</span>
        </div>
        {etaLabel && (
          <div className="status-overall-eta">{etaLabel}</div>
        )}
      </div>

      <div className="status-grid">
        <div className="card status-pass">
          <h3>Pass 1 — Pre-filter</h3>
          <p className="status-pass-sub">Cheap classifier: keep this, skip that.</p>
          <div className="status-pass-meta">
            <div><span className="status-pass-num">{preDone.toLocaleString()}</span> / {preTotal.toLocaleString()}</div>
            <div className="status-pass-detail">
              <span className="status-chip status-chip-kept">{(pre.done ?? 0).toLocaleString()} kept</span>
              <span className="status-chip status-chip-skipped">{skipped.toLocaleString()} skipped</span>
              <span className="status-chip status-chip-pending">{(pre.pending ?? 0).toLocaleString()} pending</span>
              {Boolean(pre.failed) && <span className="status-chip status-chip-failed">{(pre.failed ?? 0).toLocaleString()} failed</span>}
            </div>
          </div>
        </div>

        <div className="card status-pass">
          <h3>Pass 2 — Deep analysis</h3>
          <p className="status-pass-sub">Full NSFW + tagger + strategist on the keepers.</p>
          <div className="status-pass-meta">
            <div><span className="status-pass-num">{anaDone.toLocaleString()}</span> / {anaTotal.toLocaleString()}</div>
            <div className="status-pass-detail">
              <span className="status-chip status-chip-kept">{(ana.done ?? 0).toLocaleString()} done</span>
              <span className="status-chip status-chip-pending">{(ana.pending ?? 0).toLocaleString()} pending</span>
              {Boolean(ana.processing) && <span className="status-chip status-chip-processing">{(ana.processing ?? 0).toLocaleString()} working</span>}
              {Boolean(ana.failed) && <span className="status-chip status-chip-failed">{(ana.failed ?? 0).toLocaleString()} failed</span>}
            </div>
          </div>
        </div>
      </div>

      {data.recent_posts.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="section-label">Most recently added to your vault</p>
          <div className="status-recent">
            {data.recent_posts.map((p) => (
              <Link key={p.id} href={`/vault?focus=${p.id}`} className="status-recent-card">
                <div className="status-recent-thumb">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="status-recent-thumb-placeholder" />
                  )}
                  <span className={`rating-pill ${p.content_rating}`}>{p.content_rating}</span>
                </div>
                <span className="status-recent-platform">{p.primary_platform}</span>
              </Link>
            ))}
          </div>
          <Link href="/vault" className="btn-ghost" style={{ marginTop: 14, display: "inline-block" }}>
            Open vault →
          </Link>
        </div>
      )}

      {data.recent_failures.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="section-label" style={{ color: "var(--rating-nsfw)" }}>Recent failures</p>
          <ul className="status-failures">
            {data.recent_failures.map((f, i) => (
              <li key={i}>
                <strong>{f.name}</strong> <span style={{ color: "var(--muted)" }}>({f.kind})</span>
                <div>{f.error}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cta-row" style={{ marginTop: 24, flexWrap: "wrap" }}>
        <Link href="/vault" className="btn btn-primary">Open vault</Link>
        <Link href="/import" className="btn btn-secondary">Import another folder</Link>
        {(remaining > 0 || failed > 0) && (
          <>
            <button
              className="btn btn-secondary"
              onClick={retryAll}
              disabled={retrying}
              title="Resets every job in this batch (status → pending, attempts → 0) so the worker re-processes them. Use after a transient failure window like a Dropbox disconnect or a Replicate rate-limit period."
            >
              {retrying ? "Working…" : "Retry stuck jobs"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={cancelOthers}
              disabled={retrying}
              title="If you ran multiple imports, older half-failed batches keep stealing the worker's attention. This cancels every other running batch so this one drains first."
            >
              Cancel old batches
            </button>
          </>
        )}
      </div>
      {retryMsg && (
        <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--muted-strong)" }}>
          {retryMsg}
        </p>
      )}
    </main>
  );
}
