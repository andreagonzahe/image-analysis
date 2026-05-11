"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { savePost } from "@/lib/vault";
import type { FullResult } from "@/components/ResultCard";

type Status = "pending" | "processing" | "done" | "error";

type Item = {
  id: string;
  dataUrl: string;
  status: Status;
  result?: FullResult;
  error?: string;
};

const PER_IMAGE_ESTIMATE = 45;

export function BatchQueue({
  initial,
  onReset,
}: {
  initial: string[];
  onReset: () => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((dataUrl) => ({
      id: crypto.randomUUID(),
      dataUrl,
      status: "pending" as Status,
    }))
  );
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef(false);

  // Auto-start
  useEffect(() => {
    void run();
    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!startTs || !running) return;
    const id = setInterval(() => setElapsed((Date.now() - startTs) / 1000), 500);
    return () => clearInterval(id);
  }, [startTs, running]);

  async function run() {
    setRunning(true);
    setStartTs(Date.now());
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      setItems((curr) => curr.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it)));
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: items[i].dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analyze failed");
        await savePost({ imageDataUrl: items[i].dataUrl, analysis: data });
        setItems((curr) => curr.map((it, idx) => (idx === i ? { ...it, status: "done", result: data } : it)));
        setDoneCount((c) => c + 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setItems((curr) => curr.map((it, idx) => (idx === i ? { ...it, status: "error", error: msg } : it)));
        setErrorCount((c) => c + 1);
      }
    }
    setRunning(false);
  }

  const total = items.length;
  const completed = doneCount + errorCount;
  const remaining = total - completed;
  const etaSeconds = Math.max(0, remaining * PER_IMAGE_ESTIMATE - (elapsed % PER_IMAGE_ESTIMATE));
  const overallPct = total === 0 ? 0 : completed / total;
  const allDone = !running && completed === total;

  return (
    <div className="batch-shell">
      <div className="batch-header">
        <div>
          <h2 className="batch-title">
            {allDone
              ? `Done — ${doneCount} analyzed${errorCount ? `, ${errorCount} failed` : ""}`
              : `Analyzing ${total} image${total === 1 ? "" : "s"}`}
          </h2>
          <p className="batch-sub">
            {allDone
              ? "Each completed analysis is now in your vault."
              : "Each one takes ~30–50s. Auto-saving to your vault as they finish."}
          </p>
        </div>
        {allDone ? (
          <div className="batch-actions">
            <Link href="/vault" className="btn btn-primary">View vault →</Link>
            <button className="btn btn-secondary" onClick={onReset}>Start over</button>
          </div>
        ) : (
          <div className="batch-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                cancelRef.current = true;
              }}
              disabled={!running}
            >
              Cancel remaining
            </button>
          </div>
        )}
      </div>

      <div className="batch-progress-card">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.round(overallPct * 100)}%` }} />
        </div>
        <div className="batch-progress-meta">
          <span>{completed} / {total} done</span>
          <span>
            {allDone
              ? `${Math.round(elapsed)}s total`
              : `~${Math.ceil(etaSeconds / 60)} min remaining`}
          </span>
        </div>
      </div>

      <div className="batch-grid">
        {items.map((it) => (
          <BatchTile key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

function BatchTile({ item }: { item: Item }) {
  const platform = item.result?.primary_recommendation?.platform;
  const rating = item.result?.content_rating;
  const pricing = item.result?.primary_recommendation?.pricing_suggestion;
  const priceLabel = pricing
    ? pricing.low_usd === pricing.high_usd
      ? pricing.low_usd === 0
        ? "Free"
        : `$${pricing.low_usd}`
      : `$${pricing.low_usd}–$${pricing.high_usd}`
    : null;

  return (
    <div className={`batch-tile batch-tile-${item.status}`}>
      <div className="batch-thumb">
        <img src={item.dataUrl} alt="" />
        {rating && <span className={`rating-pill ${rating}`}>{rating}</span>}
      </div>
      <div className="batch-tile-body">
        <div className="batch-tile-status">
          {item.status === "pending" && <span className="status-dot status-pending" />}
          {item.status === "processing" && <span className="spinner-small" />}
          {item.status === "done" && <span className="status-dot status-done" />}
          {item.status === "error" && <span className="status-dot status-error" />}
          <span className="batch-tile-label">
            {item.status === "pending" && "Queued"}
            {item.status === "processing" && "Analyzing…"}
            {item.status === "done" && platform}
            {item.status === "error" && "Error"}
          </span>
          {priceLabel && <span className="batch-tile-price">{priceLabel}</span>}
        </div>
        {item.status === "error" && (
          <p className="batch-tile-error" title={item.error}>{item.error?.slice(0, 90)}</p>
        )}
      </div>
    </div>
  );
}
