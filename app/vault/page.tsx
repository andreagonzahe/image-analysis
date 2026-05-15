"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { listMergedPosts, deletePost, blobToObjectUrl, syncAllLocalToCloud, updatePostStatus, deleteEntireVault, type MergedPost, type PostStatus } from "@/lib/vault";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/**
 * Compact "posted N ago" — kept short so it fits inside the badge corner.
 * Hours when <1d, days when <30d, otherwise the date. Always says "Posted".
 */
function formatPostedAgo(isoOrMs: string | number | null | undefined): string {
  if (!isoOrMs) return "Posted";
  const t = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  if (!isFinite(t)) return "Posted";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "Posted";
  const mins = diffMs / 60000;
  if (mins < 60) return `Posted ${Math.max(1, Math.round(mins))}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `Posted ${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `Posted ${Math.round(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `Posted ${Math.round(months)}mo ago`;
  return `Posted ${new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

type RatingFilter = "all" | "SFW" | "suggestive" | "NSFW";
type SortKey =
  | "recent"
  | "oldest"
  | "price_high"
  | "price_low"
  | "platform"
  | "posted_recent"
  | "posted_oldest"
  | "unposted_first";
type SourceFilter = "all" | "local" | "remote" | "both";
type StatusFilter = "all" | "not_posted" | "posted" | "skipped";

type AuthState = { auth_enabled: boolean; sync_enabled: boolean; signed_in: boolean };

export default function VaultPage() {
  const [posts, setPosts] = useState<MergedPost[] | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [cleanupCount, setCleanupCount] = useState<number | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);

  const scanForCleanup = async () => {
    setCleanupRunning(true);
    setCleanupMsg(null);
    try {
      const res = await fetch("/api/vault/cleanup-no-people");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setCleanupCount(data.count ?? 0);
    } catch (e) {
      setCleanupMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCleanupRunning(false);
    }
  };

  const runCleanup = async () => {
    if (!confirm(`Delete ${cleanupCount} post${cleanupCount === 1 ? "" : "s"} that don't contain a visible person? This can't be undone.`)) return;
    setCleanupRunning(true);
    setCleanupMsg(null);
    try {
      const res = await fetch("/api/vault/cleanup-no-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "REMOVE NO-PEOPLE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cleanup failed");
      setCleanupCount(0);
      setCleanupMsg(`Removed ${data.posts_deleted} post${data.posts_deleted === 1 ? "" : "s"}.`);
      // Refresh the grid.
      const fresh = await listMergedPosts();
      setPosts(fresh);
    } catch (e) {
      setCleanupMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCleanupRunning(false);
    }
  };

  const wipeVault = async () => {
    if (wipeConfirmText !== "DELETE EVERYTHING") return;
    setWiping(true);
    setWipeError(null);
    try {
      const result = await deleteEntireVault();
      setPosts([]);
      setThumbUrls({});
      setShowWipeModal(false);
      setWipeConfirmText("");
      // Soft success message via the existing migrate slot.
      setMigrateMsg(
        `Vault wiped. Removed ${result.cloud_posts} cloud post${result.cloud_posts === 1 ? "" : "s"}, ${result.cloud_storage} stored image${result.cloud_storage === 1 ? "" : "s"}, and ${result.local_posts} local entr${result.local_posts === 1 ? "y" : "ies"}.`
      );
    } catch (e) {
      setWipeError(e instanceof Error ? e.message : String(e));
    } finally {
      setWiping(false);
    }
  };

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
    if (statusFilter === "posted") {
      out = out.filter((p) => p.status === "posted");
    } else if (statusFilter === "not_posted") {
      out = out.filter((p) => p.status === "pending" || p.status === "scheduled" || !p.status);
    } else if (statusFilter === "skipped") {
      out = out.filter((p) => p.status === "skipped");
    }

    const postedTime = (p: MergedPost) =>
      p.posted_at ? new Date(p.posted_at).getTime() : null;

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
      case "posted_recent":
        // Most recently posted first. Never-posted items fall to the bottom.
        out.sort((a, b) => {
          const at = postedTime(a);
          const bt = postedTime(b);
          if (at === null && bt === null) return b.created_at - a.created_at;
          if (at === null) return 1;
          if (bt === null) return -1;
          return bt - at;
        });
        break;
      case "posted_oldest":
        // Oldest posted first — surfaces content that's been sitting longest
        // since you last reused it.
        out.sort((a, b) => {
          const at = postedTime(a);
          const bt = postedTime(b);
          if (at === null && bt === null) return a.created_at - b.created_at;
          if (at === null) return 1;
          if (bt === null) return -1;
          return at - bt;
        });
        break;
      case "unposted_first":
        // Unposted items first (oldest backlog first), then posted by date desc.
        out.sort((a, b) => {
          const aUnposted = a.status !== "posted";
          const bUnposted = b.status !== "posted";
          if (aUnposted !== bUnposted) return aUnposted ? -1 : 1;
          if (aUnposted) return a.created_at - b.created_at; // both unposted: oldest first
          const at = postedTime(a) ?? 0;
          const bt = postedTime(b) ?? 0;
          return bt - at; // both posted: most recent first
        });
        break;
    }
    return out;
  }, [posts, ratingFilter, platformFilter, sourceFilter, statusFilter, sort]);

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

  const onSetStatus = async (id: string, status: PostStatus, platformId: string) => {
    // Optimistic update so the badge and sort order respond instantly.
    setPosts((curr) =>
      curr
        ? curr.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status,
                  posted_at: status === "posted" ? new Date().toISOString() : null,
                  posted_on_platform: status === "posted" ? platformId : null,
                }
              : p
          )
        : curr
    );
    try {
      await updatePostStatus(id, {
        status,
        posted_on_platform: status === "posted" ? platformId : null,
      });
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
          <SignInButton
            mode="modal"
            forceRedirectUrl="/vault"
            signUpForceRedirectUrl="/vault"
            appearance={{
              elements: {
                button: {
                  background: "var(--accent)",
                  color: "white",
                  border: 0,
                  padding: "10px 18px",
                  borderRadius: "9px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                },
              },
            }}
          />
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
            <div className="chip-row">
              <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Any status</Chip>
              <Chip active={statusFilter === "not_posted"} onClick={() => setStatusFilter("not_posted")}>Not posted yet</Chip>
              <Chip active={statusFilter === "posted"} onClick={() => setStatusFilter("posted")}>Posted</Chip>
              <Chip active={statusFilter === "skipped"} onClick={() => setStatusFilter("skipped")}>Skipped</Chip>
            </div>
            <div className="sort-row">
              <label htmlFor="sort" className="sort-label">Sort</label>
              <select id="sort" className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <optgroup label="By date added">
                  <option value="recent">Most recently added</option>
                  <option value="oldest">Oldest added</option>
                </optgroup>
                <optgroup label="By posting status">
                  <option value="unposted_first">Unposted first, then by post date</option>
                  <option value="posted_recent">Posted most recently</option>
                  <option value="posted_oldest">Posted longest ago (re-use these)</option>
                </optgroup>
                <optgroup label="By price">
                  <option value="price_high">Highest price</option>
                  <option value="price_low">Lowest price</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="platform">Platform (A–Z)</option>
                </optgroup>
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
                  onSetStatus={(status) => onSetStatus(post.id, status, post.primary_platform)}
                />
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <>
              <section className="vault-cleanup-zone">
                <div>
                  <h3 className="vault-cleanup-title">Clean up no-people pictures</h3>
                  <p className="vault-cleanup-body">
                    Find every analyzed post that doesn&rsquo;t contain a visible person —
                    landscapes, food shots, screenshots, pet pics, room interiors. Older
                    imports (before the stricter prefilter) often have these slipping through.
                  </p>
                  {cleanupCount !== null && cleanupCount > 0 && (
                    <p className="vault-cleanup-body" style={{ marginTop: 8 }}>
                      <strong>{cleanupCount.toLocaleString()} post{cleanupCount === 1 ? "" : "s"} found.</strong>{" "}
                      Click below to delete them.
                    </p>
                  )}
                  {cleanupCount === 0 && (
                    <p className="vault-cleanup-body" style={{ marginTop: 8 }}>
                      <strong>Nothing to clean up — every post in your vault has a person in it.</strong>
                    </p>
                  )}
                  {cleanupMsg && (
                    <p className="vault-cleanup-body" style={{ marginTop: 8, color: "var(--accent-strong)" }}>{cleanupMsg}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {cleanupCount === null ? (
                    <button className="btn btn-secondary" onClick={scanForCleanup} disabled={cleanupRunning}>
                      {cleanupRunning ? "Scanning…" : "Scan for no-people posts"}
                    </button>
                  ) : cleanupCount > 0 ? (
                    <button className="btn btn-danger" onClick={runCleanup} disabled={cleanupRunning}>
                      {cleanupRunning ? "Removing…" : `Remove ${cleanupCount.toLocaleString()} post${cleanupCount === 1 ? "" : "s"}`}
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={scanForCleanup} disabled={cleanupRunning}>
                      Rescan
                    </button>
                  )}
                </div>
              </section>

              <section className="vault-danger-zone">
                <div>
                  <h3 className="vault-danger-title">Danger zone</h3>
                  <p className="vault-danger-body">
                    Wipe everything in your vault. Removes every analyzed post,
                    every cloud-stored image, and the local IndexedDB copy on
                    this device. Dropbox files themselves stay safe in your
                    Dropbox. <strong>This cannot be undone.</strong>
                  </p>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setWipeError(null);
                    setWipeConfirmText("");
                    setShowWipeModal(true);
                  }}
                >
                  Delete entire vault
                </button>
              </section>
            </>
          )}
        </>
      )}

      {showWipeModal && (
        <div className="wipe-modal" role="dialog" aria-modal="true">
          <div className="wipe-overlay" onClick={() => !wiping && setShowWipeModal(false)} aria-hidden />
          <div className="wipe-card">
            <h2 className="wipe-title">Delete your entire vault?</h2>
            <p className="wipe-body">
              You&rsquo;re about to permanently remove <strong>{posts?.length ?? 0}</strong> analyzed
              post{posts?.length === 1 ? "" : "s"} from this app — including every cloud-stored
              image and the local IndexedDB cache on this device.
            </p>
            <ul className="wipe-checklist">
              <li><strong>Cannot be undone.</strong> There is no trash, no archive, no recovery.</li>
              <li>Your <strong>Dropbox files stay</strong> in your Dropbox — only Postwise&rsquo;s analysis records get wiped.</li>
              <li>You&rsquo;ll need to re-import to rebuild the vault.</li>
            </ul>
            <label className="wipe-confirm-label">
              Type <code>DELETE EVERYTHING</code> to confirm:
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="DELETE EVERYTHING"
                autoFocus
                disabled={wiping}
              />
            </label>
            {wipeError && <div className="error-banner" style={{ marginTop: 12 }}>{wipeError}</div>}
            <div className="wipe-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowWipeModal(false)}
                disabled={wiping}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={wipeVault}
                disabled={wipeConfirmText !== "DELETE EVERYTHING" || wiping}
              >
                {wiping ? "Wiping…" : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
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
  onSetStatus,
}: {
  post: MergedPost;
  thumbUrl: string | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSetStatus: (status: PostStatus) => void;
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
          <img src={thumbUrl} alt="" loading="lazy" decoding="async" />
        ) : post.remote_image_url ? (
          <img src={post.remote_image_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="vault-thumb-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span>Image unavailable</span>
          </div>
        )}
        <span className={`rating-pill ${post.content_rating}`}>{post.content_rating}</span>
        {isRemoteOnly && <span className="source-badge">Synced</span>}
        {post.status === "posted" ? (
          <span
            className="status-badge status-badge-posted"
            title={post.posted_at ? `Posted ${new Date(post.posted_at).toLocaleString()}${post.posted_on_platform ? ` on ${platformName(post.posted_on_platform)}` : ""}` : "Posted"}
          >
            ✓ {formatPostedAgo(post.posted_at)}
          </span>
        ) : post.status && post.status !== "pending" ? (
          <span className={`status-badge status-badge-${post.status}`}>{post.status}</span>
        ) : null}
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
          {post.status === "posted" ? (
            <button
              className="btn-ghost"
              onClick={() => onSetStatus("pending")}
              title="Unmark — useful if you want to repost or reset the date"
            >
              Mark unposted
            </button>
          ) : (
            <button
              className="btn-ghost"
              onClick={() => onSetStatus("posted")}
              title="Record that you posted this — saves the timestamp so you can sort + reuse later"
            >
              ✓ Mark posted
            </button>
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
