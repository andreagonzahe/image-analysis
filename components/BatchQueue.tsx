"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { savePost } from "@/lib/vault";
import { prepImage } from "@/lib/image-prep";
import type { FullResult } from "@/components/ResultCard";
import { PLATFORMS } from "@/lib/platforms";
import { TileProgress } from "@/components/TileProgress";

type Status = "queued" | "preparing" | "analyzing" | "done" | "error";

type Item = {
  id: string;
  file: File;
  fileName: string;
  dataUrl?: string;
  status: Status;
  result?: FullResult;
  error?: string;
  phaseStartedAt?: number; // ms epoch when current phase started
};

const PER_IMAGE_ESTIMATE = 40;

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
const platformComposeUrl = (id: string) => PLATFORMS.find((p) => p.id === id)?.composeUrl;

export function BatchQueue({ files, onReset }: { files: File[]; onReset: () => void }) {
  const [items, setItems] = useState<Item[]>(() =>
    files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      status: "queued" as Status,
    }))
  );
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cancelRef = useRef(false);

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

  async function processItem(itemId: string, isRetry: boolean): Promise<void> {
    const idx = items.findIndex((it) => it.id === itemId);
    if (idx === -1) return;
    const file = items[idx].file;

    // Step 1: prep (HEIC → JPEG and resize).
    setItems((curr) =>
      curr.map((it) => (it.id === itemId ? { ...it, status: "preparing", phaseStartedAt: Date.now(), error: undefined } : it))
    );
    let dataUrl: string;
    try {
      dataUrl = await prepImage(file);
      setItems((curr) =>
        curr.map((it) => (it.id === itemId ? { ...it, dataUrl, status: "analyzing", phaseStartedAt: Date.now() } : it))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setItems((curr) => curr.map((it) => (it.id === itemId ? { ...it, status: "error", error: `Couldn't read image: ${msg}` } : it)));
      if (!isRetry) setErrorCount((c) => c + 1);
      return;
    }

    // Step 2: analyze + save to vault
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyze failed");
      await savePost({ imageDataUrl: dataUrl, analysis: data });
      setItems((curr) => curr.map((it) => (it.id === itemId ? { ...it, status: "done", result: data } : it)));
      if (isRetry) {
        setErrorCount((c) => Math.max(0, c - 1));
        setDoneCount((c) => c + 1);
      } else {
        setDoneCount((c) => c + 1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setItems((curr) => curr.map((it) => (it.id === itemId ? { ...it, status: "error", error: msg } : it)));
      if (!isRetry) setErrorCount((c) => c + 1);
    }
  }

  async function run() {
    setRunning(true);
    setStartTs(Date.now());
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      await processItem(items[i].id, false);
    }
    setRunning(false);
  }

  async function retryItem(itemId: string) {
    await processItem(itemId, true);
  }

  const total = items.length;
  const completed = doneCount + errorCount;
  const remaining = total - completed;
  const etaSeconds = Math.max(0, remaining * PER_IMAGE_ESTIMATE);
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
              ? "Each completed analysis is in your vault. Click any tile to open it inline."
              : "Auto-saving to your vault as they finish. Click any done tile to start posting it now while the rest run."}
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
          <BatchTile
            key={it.id}
            item={it}
            expanded={expandedId === it.id}
            onToggle={() => setExpandedId((cur) => (cur === it.id ? null : it.id))}
            onRetry={() => retryItem(it.id)}
          />
        ))}
      </div>
    </div>
  );
}

function BatchTile({
  item,
  expanded,
  onToggle,
  onRetry,
}: {
  item: Item;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const platform = item.result?.primary_recommendation?.platform;
  const rating = item.result?.content_rating;
  const tier = item.result?.content_tier;
  const pricing = item.result?.primary_recommendation?.pricing_suggestion;
  const priceLabel = pricing
    ? pricing.low_usd === pricing.high_usd
      ? pricing.low_usd === 0
        ? "Free"
        : `$${pricing.low_usd}`
      : `$${pricing.low_usd}–$${pricing.high_usd}`
    : null;

  const isDone = item.status === "done";
  const canToggle = isDone;

  const statusLabel = (() => {
    switch (item.status) {
      case "queued":
        return "Queued";
      case "preparing":
        return "Reading image…";
      case "analyzing":
        return "Analyzing…";
      case "done":
        return platform ? platformName(platform) : "Done";
      case "error":
        return "Error";
    }
  })();

  return (
    <div className={`batch-tile batch-tile-${item.status} ${expanded ? "batch-tile-expanded" : ""}`}>
      <button
        type="button"
        className="batch-tile-clickable"
        onClick={canToggle ? onToggle : undefined}
        disabled={!canToggle}
        aria-expanded={expanded}
      >
        <div className="batch-thumb">
          {item.dataUrl ? (
            <img src={item.dataUrl} alt="" />
          ) : (
            <div className="batch-thumb-placeholder">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span className="batch-thumb-filename">{item.fileName}</span>
            </div>
          )}
          {rating && <span className={`rating-pill ${rating}`}>{rating}</span>}
          {tier && <span className="batch-tile-tier" data-tier={tier}>T{tier}</span>}
        </div>
        <div className="batch-tile-body">
          {(item.status === "preparing" || item.status === "analyzing") && item.phaseStartedAt ? (
            <TileProgress startedAt={item.phaseStartedAt} phase={item.status} />
          ) : (
            <div className="batch-tile-status">
              {item.status === "queued" && <span className="status-dot status-pending" />}
              {item.status === "done" && <span className="status-dot status-done" />}
              {item.status === "error" && <span className="status-dot status-error" />}
              <span className="batch-tile-label">{statusLabel}</span>
              {priceLabel && <span className="batch-tile-price">{priceLabel}</span>}
            </div>
          )}
          {item.status === "error" && (
            <p className="batch-tile-error" title={item.error}>{item.error?.slice(0, 90)}</p>
          )}
          {isDone && (
            <p className="batch-tile-hint">{expanded ? "Hide" : "Click to open"}</p>
          )}
        </div>
      </button>

      {item.status === "error" && (
        <div className="batch-tile-retry-row">
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            ↻ Retry this image
          </button>
        </div>
      )}

      {expanded && item.result && <BatchTileExpanded result={item.result} />}
    </div>
  );
}

function BatchTileExpanded({ result }: { result: FullResult }) {
  const pr = result.primary_recommendation;
  const composeUrl = platformComposeUrl(pr.platform);
  const fs = result.funnel_strategy;

  const [copied, setCopied] = useState(false);
  const fullText = pr.hashtags?.length ? `${pr.caption}\n\n${pr.hashtags.join(" ")}` : pr.caption;

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="batch-tile-expanded-body">
      {fs && (
        <p className="batch-funnel-mini">
          <strong>Tier {fs.this_image_tier} · {fs.this_image_role.replace(/-/g, " ")}.</strong>{" "}
          {fs.monetization_path}
        </p>
      )}
      <p className="caption-block" style={{ marginTop: 10 }}>{pr.caption}</p>
      {pr.hashtags?.length > 0 && (
        <ul className="hashtags" style={{ marginTop: 8 }}>
          {pr.hashtags.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}
      <div className="caption-actions" style={{ marginTop: 12 }}>
        <button className="btn-ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy caption"}
        </button>
        {composeUrl && (
          <a className="btn-compose" href={composeUrl} target="_blank" rel="noopener noreferrer">
            Open {platformName(pr.platform)} →
          </a>
        )}
      </div>
    </div>
  );
}
