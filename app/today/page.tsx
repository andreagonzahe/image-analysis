"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listMergedPosts,
  updatePostStatus,
  blobToObjectUrl,
  type MergedPost,
  type PostStatus,
} from "@/lib/vault";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
const platformComposeUrl = (id: string) => PLATFORMS.find((p) => p.id === id)?.composeUrl;

const DAILY_TARGET = 5;

export default function TodayPage() {
  const [posts, setPosts] = useState<MergedPost[] | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMergedPosts()
      .then((items) => {
        if (cancelled) return;
        setPosts(items);
        const urls: Record<string, string> = {};
        for (const p of items) if (p.thumb_blob) urls[p.id] = blobToObjectUrl(p.thumb_blob);
        setThumbUrls(urls);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: PostStatus) => {
    setPosts((curr) =>
      curr
        ? curr.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status,
                  posted_at: status === "posted" ? new Date().toISOString() : null,
                  posted_on_platform: status === "posted" ? p.primary_platform : null,
                }
              : p
          )
        : curr
    );
    try {
      await updatePostStatus(id, { status, posted_on_platform: status === "posted" ? null : null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const today = useMemo(() => {
    if (!posts) return { plan: [], stats: null };
    // Today's plan: prioritize PENDING items, score by funnel value.
    // Score: paid platforms (high revenue potential) first; then tier (3+ = paywall, important);
    // then oldest pending (FIFO so backlog doesn't pile up).
    const pending = posts.filter((p) => p.status === "pending");
    const scored = pending.map((p) => {
      let score = 0;
      const platform = PLATFORMS.find((pl) => pl.id === p.primary_platform);
      if (platform?.paid) score += 100;
      if ((p.analysis.content_tier ?? 1) >= 3) score += 50;
      if (p.primary_price_low > 0) score += Math.min(p.primary_price_low, 40);
      // older items get a small recency boost so the backlog flushes
      const ageDays = (Date.now() - p.created_at) / (1000 * 60 * 60 * 24);
      score += Math.min(ageDays * 2, 20);
      return { ...p, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);
    const plan = scored.slice(0, DAILY_TARGET);

    const postedToday = posts.filter((p) => {
      if (p.status !== "posted" || !p.posted_at) return false;
      const t = new Date(p.posted_at);
      const d = new Date();
      return t.toDateString() === d.toDateString();
    }).length;

    const postedThisWeek = posts.filter((p) => {
      if (p.status !== "posted" || !p.posted_at) return false;
      const t = new Date(p.posted_at).getTime();
      return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
    }).length;

    const pendingTotal = pending.length;

    return {
      plan,
      stats: { postedToday, postedThisWeek, pendingTotal },
    };
  }, [posts]);

  if (posts === null && !error) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Today</h1>
          <p className="hero-sub">Loading your queue…</p>
        </header>
      </main>
    );
  }

  if (posts && posts.length === 0) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Today</h1>
          <p className="hero-sub">
            Your vault is empty. Analyze some content first — then come back here for your daily plan.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link href="/" className="btn btn-primary">Analyze content</Link>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main>
      <header className="today-hero">
        <div>
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>Today&rsquo;s plan</h1>
          <p className="hero-sub" style={{ margin: 0 }}>
            {today.plan.length > 0
              ? `Top ${today.plan.length} pieces to post today, ranked by funnel value. Tick them off as you go.`
              : "Nothing pending. Analyze more content or come back tomorrow."}
          </p>
        </div>
        {today.stats && (
          <div className="today-stats">
            <div className="today-stat">
              <span className="today-stat-num">{today.stats.postedToday}</span>
              <span className="today-stat-label">Posted today</span>
            </div>
            <div className="today-stat">
              <span className="today-stat-num">{today.stats.postedThisWeek}</span>
              <span className="today-stat-label">This week</span>
            </div>
            <div className="today-stat">
              <span className="today-stat-num">{today.stats.pendingTotal}</span>
              <span className="today-stat-label">In backlog</span>
            </div>
          </div>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="today-list">
        {today.plan.map((post, i) => (
          <TodayCard
            key={post.id}
            post={post}
            index={i}
            thumbUrl={thumbUrls[post.id]}
            onMarkPosted={() => setStatus(post.id, "posted")}
            onSkip={() => setStatus(post.id, "skipped")}
            onSchedule={() => setStatus(post.id, "scheduled")}
          />
        ))}
      </div>

      {today.plan.length === 0 && today.stats && today.stats.pendingTotal === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40, marginTop: 24 }}>
          <p style={{ marginBottom: 16, color: "var(--muted-strong)" }}>
            All caught up. Every piece in your vault has been posted, scheduled, or skipped.
          </p>
          <Link href="/" className="btn btn-primary">Add more content</Link>
        </div>
      )}
    </main>
  );
}

function TodayCard({
  post,
  index,
  thumbUrl,
  onMarkPosted,
  onSkip,
  onSchedule,
}: {
  post: MergedPost;
  index: number;
  thumbUrl: string | undefined;
  onMarkPosted: () => void;
  onSkip: () => void;
  onSchedule: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pr = post.analysis.primary_recommendation;
  const fs = post.analysis.funnel_strategy;
  const composeUrl = platformComposeUrl(pr.platform);

  const fullText = pr.hashtags?.length ? `${pr.caption}\n\n${pr.hashtags.join(" ")}` : pr.caption;
  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const priceLabel = post.primary_price_low > 0
    ? post.primary_price_low === post.primary_price_high
      ? `$${post.primary_price_low}`
      : `$${post.primary_price_low}–$${post.primary_price_high}`
    : null;

  return (
    <article className="today-card">
      <div className="today-card-rank">#{index + 1}</div>

      <div className="today-card-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" />
        ) : post.remote_image_url ? (
          <img src={post.remote_image_url} alt="" />
        ) : (
          <div className="vault-thumb-placeholder">
            <span>Image on another device</span>
          </div>
        )}
        {fs && (
          <span className="today-card-tier" data-tier={fs.this_image_tier}>T{fs.this_image_tier}</span>
        )}
      </div>

      <div className="today-card-body">
        <div className="today-card-header">
          <h2 className="today-card-platform">{platformName(pr.platform)}</h2>
          {priceLabel && <span className="today-card-price">{priceLabel}</span>}
        </div>

        {pr.post_type?.label && (
          <span className="today-card-posttype">{pr.post_type.label.replace(/_/g, " ")}</span>
        )}

        {fs && (
          <p className="today-card-funnel">
            <strong>{fs.this_image_role.replace(/-/g, " ")}.</strong> {fs.monetization_path}
          </p>
        )}

        <div className="today-card-caption">
          <span className="today-card-caption-label">Caption</span>
          <p className="caption-block">{pr.caption}</p>
          {pr.hashtags?.length > 0 && (
            <ul className="hashtags">
              {pr.hashtags.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
        </div>

        <div className="today-card-actions">
          <button className="btn-ghost" onClick={copy}>
            {copied ? "Copied ✓" : "Copy caption"}
          </button>
          {composeUrl && (
            <a className="btn-compose" href={composeUrl} target="_blank" rel="noopener noreferrer">
              Open {platformName(pr.platform)} →
            </a>
          )}
          <button className="btn btn-primary today-mark-posted" onClick={onMarkPosted}>
            ✓ Mark as posted
          </button>
          <button className="btn-ghost" onClick={onSchedule}>
            Schedule later
          </button>
          <button className="btn-ghost btn-danger" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </article>
  );
}
