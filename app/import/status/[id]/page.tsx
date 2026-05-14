"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type BatchStatus = {
  batch: {
    id: string;
    label: string;
    status: "running" | "completed" | "cancelled";
    total_jobs: number;
    done_jobs: number;
    failed_jobs: number;
    created_at: string;
    completed_at: string | null;
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
  }>;
};

export default function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const isDone = data.batch.status !== "running";
  const total = data.batch.total_jobs;
  const done = data.batch.done_jobs;
  const failed = data.batch.failed_jobs;
  const remaining = Math.max(0, total - done - failed);
  const pct = total === 0 ? 0 : Math.round(((done + failed) / total) * 100);

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
          {isDone ? "Import complete" : "Importing…"}
        </h1>
        <p className="hero-sub">
          {isDone
            ? `Finished. ${kept.toLocaleString()} pieces added to your vault, ${skipped.toLocaleString()} skipped as noise.`
            : `Working on "${data.batch.label}". You can close this tab — we'll keep going in the background.`}
        </p>
      </header>

      <div className="card status-overall">
        <div className="progress-bar" style={{ height: 12 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="status-overall-meta">
          <span>{(done + failed).toLocaleString()} / {total.toLocaleString()} jobs</span>
          <span>{pct}%</span>
          <span>{remaining.toLocaleString()} remaining</span>
        </div>
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
                <span className={`rating-pill ${p.content_rating}`}>{p.content_rating}</span>
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

      <div className="cta-row" style={{ marginTop: 24 }}>
        <Link href="/vault" className="btn btn-primary">Open vault</Link>
        <Link href="/import" className="btn btn-secondary">Import another folder</Link>
      </div>
    </main>
  );
}
