"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listMergedPosts, deletePost, blobToObjectUrl, syncAllLocalToCloud, type MergedPost } from "@/lib/vault";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

type RatingFilter = "all" | "SFW" | "suggestive" | "NSFW";
type SortKey = "recent" | "oldest" | "price_high" | "price_low" | "platform";
type SourceFilter = "all" | "local" | "remote" | "both";

type AuthState = { auth_enabled: boolean; sync_enabled: boolean; signed_in: boolean };

export default function VaultPage() {
  const [posts, setPosts] = useState<MergedPost[] | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth-state").then((r) => r.json()).then(setAuthState).catch(() => null);
  }, []);

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
  }, [authState?.signed_in]);

  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!posts) return [];
    let out = posts.slice();
    if (ratingFilter !== "all") out = out.filter((p) => p.content_rating === ratingFilter);
    if (platformFilter !== "all") out = out.filter((p) => p.primary_platform === platformFilter);
    if (sourceFilter !== "all") out = out.filter((p) => p.source === sourceFilter || (sourceFilter === "remote" && p.source === "both"));

    switch (sort) {
      case "recent":
        out.sort((a, b) => b.created_at - a.created_at);
        break;
      case "oldest":
        out.sort((a, b) => a.created_at - b.created_at);
        break;
      case "price_high":
        out.sort((a, b) => b.primary_price_high - a.primary_price_high);
        break;
      case "price_low":
        out.sort((a, b) => {
          const ap = a.primary_price_low === -1 ? Infinity : a.primary_price_low;
          const bp = b.primary_price_low === -1 ? Infinity : b.primary_price_low;
          return ap - bp;
        });
        break;
      case "platform":
        out.sort((a, b) => platformName(a.primary_platform).localeCompare(platformName(b.primary_platform)));
        break;
    }
    return out;
  }, [posts, ratingFilter, platformFilter, sourceFilter, sort]);

  const platformsInVault = useMemo(() => {
    if (!posts) return [];
    return Array.from(new Set(posts.map((p) => p.primary_platform)));
  }, [posts]);

  const localOnlyCount = useMemo(() => {
    if (!posts) return 0;
    return posts.filter((p) => p.source === "local").length;
  }, [posts]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this post from your vault?")) return;
    try {
      await deletePost(id);
      setPosts((curr) => (curr ? curr.filter((p) => p.id !== id) : null));
      if (thumbUrls[id]) {
        URL.revokeObjectURL(thumbUrls[id]);
        setThumbUrls(({ [id]: _, ...rest }) => rest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const migrate = async () => {
    setMigrating(true);
    setMigrateMsg(null);
    try {
      const count = await syncAllLocalToCloud();
      setMigrateMsg(`Synced ${count} post${count === 1 ? "" : "s"} to your account.`);
      const fresh = await listMergedPosts();
      setPosts(fresh);
    } catch (e) {
      setMigrateMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setMigrating(false);
    }
  };

  if (posts === null && !error) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Vault</h1>
          <p className="hero-sub">Loading your saved posts…</p>
        </header>
      </main>
    );
  }

  return (
    <main>
      <header className="vault-hero">
        <div>
          <h1 className="title" style={{ marginBottom: 8 }}>Your vault</h1>
          <p className="hero-sub" style={{ margin: 0 }}>
            {posts && posts.length > 0
              ? `${posts.length} saved post${posts.length === 1 ? "" : "s"}.${
                  authState?.sync_enabled && authState?.signed_in
                    ? " Synced across your devices via your account."
                    : " Stored only in this browser."
                }`
              : "Nothing saved yet. Analyze an image, then tap Save to vault."}
          </p>
        </div>
        <Link href="/" className="btn btn-primary">
          New analysis
        </Link>
      </header>

      {authState?.sync_enabled && !authState?.signed_in && posts && posts.length > 0 && (
        <div className="cta-banner">
          <div>
            <strong>Sync your vault across devices.</strong>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>
              Sign in to back up your analysis cards to your account. Images stay on this device — only the
              tags and captions get synced.
            </p>
          </div>
          <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
        </div>
      )}

      {authState?.sync_enabled && authState?.signed_in && localOnlyCount > 0 && (
        <div className="cta-banner cta-banner-soft">
          <div>
            <strong>{localOnlyCount} post{localOnlyCount === 1 ? "" : "s"} on this device aren&rsquo;t synced yet.</strong>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>
              Push them to your account so they&rsquo;re available from your other devices.
            </p>
            {migrateMsg && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--rating-sfw)" }}>{migrateMsg}</p>}
          </div>
          <button className="btn btn-primary" onClick={migrate} disabled={migrating}>
            {migrating ? "Syncing…" : `Sync ${localOnlyCount} post${localOnlyCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {posts && posts.length > 0 && (
        <>
          <div className="vault-controls">
            <div className="chip-row">
              <Chip active={ratingFilter === "all"} onClick={() => setRatingFilter("all")}>All</Chip>
              <Chip active={ratingFilter === "SFW"} onClick={() => setRatingFilter("SFW")}>SFW</Chip>
              <Chip active={ratingFilter === "suggestive"} onClick={() => setRatingFilter("suggestive")}>Suggestive</Chip>
              <Chip active={ratingFilter === "NSFW"} onClick={() => setRatingFilter("NSFW")}>NSFW</Chip>
            </div>
            <div className="chip-row chip-row-scroll">
              <Chip active={platformFilter === "all"} onClick={() => setPlatformFilter("all")}>All platforms</Chip>
              {platformsInVault.map((p) => (
                <Chip key={p} active={platformFilter === p} onClick={() => setPlatformFilter(p)}>
                  {platformName(p)}
                </Chip>
              ))}
            </div>
            {authState?.sync_enabled && authState?.signed_in && (
              <div className="chip-row">
                <Chip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>All sources</Chip>
                <Chip active={sourceFilter === "local"} onClick={() => setSourceFilter("local")}>This device only</Chip>
                <Chip active={sourceFilter === "remote"} onClick={() => setSourceFilter("remote")}>Synced</Chip>
              </div>
            )}
            <div className="sort-row">
              <label htmlFor="sort" className="sort-label">Sort</label>
              <select id="sort" className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="recent">Most recent</option>
                <option value="oldest">Oldest first</option>
                <option value="price_high">Highest price</option>
                <option value="price_low">Lowest price</option>
                <option value="platform">Platform (A–Z)</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
              No posts match the current filters.
            </p>
          ) : (
            <div className="vault-grid">
              {filtered.map((post) => (
                <VaultCard
                  key={post.id}
                  post={post}
                  thumbUrl={thumbUrls[post.id]}
                  expanded={expanded === post.id}
                  onToggleExpand={() => setExpanded((cur) => (cur === post.id ? null : post.id))}
                  onDelete={() => onDelete(post.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`chip${active ? " chip-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function VaultCard({
  post,
  thumbUrl,
  expanded,
  onToggleExpand,
  onDelete,
}: {
  post: MergedPost;
  thumbUrl: string | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  const a = post.analysis;
  const pr = a.primary_recommendation;
  const composeUrl = PLATFORMS.find((p) => p.id === pr.platform)?.composeUrl;
  const date = new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const priceLabel =
    post.primary_price_low === -1
      ? null
      : post.primary_price_low === post.primary_price_high
        ? `$${post.primary_price_low}`
        : `$${post.primary_price_low}–$${post.primary_price_high}`;

  const [copied, setCopied] = useState(false);
  const copyCaption = async () => {
    const text = pr.hashtags?.length ? `${pr.caption}\n\n${pr.hashtags.join(" ")}` : pr.caption;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const isRemoteOnly = post.source === "remote";

  return (
    <article className="vault-card">
      <div className="vault-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" />
        ) : (
          <div className="vault-thumb-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span>Image is on another device</span>
          </div>
        )}
        <span className={`rating-pill ${post.content_rating}`}>{post.content_rating}</span>
        {isRemoteOnly && <span className="source-badge">Synced</span>}
      </div>
      <div className="vault-body">
        <div className="vault-meta">
          <span className="vault-platform">{platformName(pr.platform)}</span>
          {priceLabel && <span className="vault-price">{priceLabel}</span>}
        </div>
        {pr.post_type?.label && (
          <div className="vault-post-type">{pr.post_type.label.replace(/_/g, " ")}</div>
        )}
        <p className="vault-caption-preview">{pr.caption}</p>
        <div className="vault-actions">
          <button className="btn-ghost" onClick={copyCaption}>
            {copied ? "Copied ✓" : "Copy caption"}
          </button>
          {composeUrl && (
            <a className="btn-compose" href={composeUrl} target="_blank" rel="noopener noreferrer">
              Open {platformName(pr.platform)} →
            </a>
          )}
          <button className="btn-ghost" onClick={onToggleExpand}>
            {expanded ? "Hide details" : "Details"}
          </button>
          <button className="btn-ghost btn-danger" onClick={onDelete} aria-label="Delete">
            Delete
          </button>
        </div>
        {expanded && (
          <div className="vault-expanded">
            <p className="reason" style={{ margin: "12px 0" }}>{pr.reason}</p>
            {pr.strategy_alignment && (
              <div className="strategy">
                <span className="strategy-label">Strategy fit</span>
                <p className="strategy-text">{pr.strategy_alignment}</p>
              </div>
            )}
            {pr.wisdom?.principle && (
              <div className="wisdom" style={{ marginTop: 12 }}>
                <p className="wisdom-principle">&ldquo;{pr.wisdom.principle}&rdquo;</p>
                <p className="wisdom-attribution">— {pr.wisdom.attribution}</p>
                {pr.wisdom.context && <p className="wisdom-context">{pr.wisdom.context}</p>}
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
              Saved {date}{isRemoteOnly ? " · uploaded from a different device" : ""}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
