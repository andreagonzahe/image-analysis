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
import type { CreatorProfile } from "@/lib/profile";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
const platformComposeUrl = (id: string) => PLATFORMS.find((p) => p.id === id)?.composeUrl;
const isPaidPlatform = (id: string) => Boolean(PLATFORMS.find((p) => p.id === id)?.paid);

/**
 * A "slot" is one piece of content the creator should post today.
 * - Each social platform they actively use → 1 slot.
 * - OnlyFans → 1 slot (single mode) or 2 slots (free + paid).
 * - Fansly → 1 slot (single mode) or 2 slots (free + paid).
 *
 * The free OF/Fansly slot is filled with Tier 1-2 funnel content
 * (lifestyle / lingerie teaser). The paid slot pulls Tier 3+ paywall
 * content. Social slots match by platform recommendation.
 */
type SlotKind =
  | { kind: "social"; platform: string; label: string }
  | { kind: "of_free" }
  | { kind: "of_paid" }
  | { kind: "of_single" }
  | { kind: "fansly_free" }
  | { kind: "fansly_paid" }
  | { kind: "fansly_single" };

type Slot = {
  id: string;
  title: string;
  subtitle: string;
  platformId: string; // canonical platform id for compose links / matching
  kind: SlotKind["kind"];
  paid: boolean;
};

type SlotFill = {
  slot: Slot;
  post: MergedPost | null;
};

function buildSlots(profile: CreatorProfile | null): Slot[] {
  const slots: Slot[] = [];
  const platforms = profile?.primary_platforms ?? [];

  // OnlyFans — now three distinct destinations.
  //   * onlyfans_free  → free promo account (Tier 1-2 teasers)
  //   * onlyfans_wall  → paid sub feed (Tier 2-3 loyalty)
  //   * onlyfans_ppv   → DM unlock (Tier 3-5 explicit)
  //
  // The user's profile primary_platforms list now includes whichever
  // of these they actually run. For back-compat with profiles that
  // still have the legacy "onlyfans" id, we treat it as "they run a
  // paid account" and add a wall + PPV slot.
  const hasLegacyOf = platforms.includes("onlyfans");
  const hasOfFree = platforms.includes("onlyfans_free") ||
    (hasLegacyOf && profile?.of_account_mode === "free_paid_pair");
  const hasOfWall = platforms.includes("onlyfans_wall") || hasLegacyOf;
  const hasOfPpv = platforms.includes("onlyfans_ppv") || hasLegacyOf;

  if (hasOfFree) {
    slots.push({
      id: "of-free",
      title: "OnlyFans — Free promo",
      subtitle: "Funnel content. Tier 1–2 teasers that drive subs to your paid account.",
      platformId: "onlyfans_free",
      kind: "of_free",
      paid: true,
    });
  }
  if (hasOfWall) {
    slots.push({
      id: "of-wall",
      title: "OnlyFans — Paid wall",
      subtitle: "Loyalty content for subs. Tier 2–3 lingerie / topless artistic max.",
      platformId: "onlyfans_wall",
      kind: "of_paid",
      paid: true,
    });
  }
  if (hasOfPpv) {
    slots.push({
      id: "of-ppv",
      title: "OnlyFans — PPV (DMs)",
      subtitle: "Pay-per-view DM unlocks. Tier 3–5 explicit content. Revenue driver.",
      platformId: "onlyfans_ppv",
      kind: "of_paid",
      paid: true,
    });
  }

  // Fansly
  if (platforms.includes("fansly")) {
    if (profile?.fansly_account_mode === "free_paid_pair") {
      slots.push({
        id: "fansly-free",
        title: "Fansly — Free promo",
        subtitle: "Funnel content. Tier 1–2 teasers.",
        platformId: "fansly",
        kind: "fansly_free",
        paid: true,
      });
      slots.push({
        id: "fansly-paid",
        title: "Fansly — Paid sub",
        subtitle: "Tier 3+ wall posts or PPV DMs.",
        platformId: "fansly",
        kind: "fansly_paid",
        paid: true,
      });
    } else {
      slots.push({
        id: "fansly-single",
        title: "Fansly",
        subtitle: "Wall post or PPV — depends on the piece.",
        platformId: "fansly",
        kind: "fansly_single",
        paid: true,
      });
    }
  }

  // Every active social/free platform gets one slot. Skip OF + Fansly
  // ids (already handled above with their own slot logic).
  const OF_IDS = new Set(["onlyfans", "onlyfans_free", "onlyfans_wall", "onlyfans_ppv"]);
  for (const id of platforms) {
    if (OF_IDS.has(id) || id === "fansly") continue;
    slots.push({
      id: `social-${id}`,
      title: platformName(id),
      subtitle: isPaidPlatform(id) ? "Paid platform." : "Daily social post.",
      platformId: id,
      kind: "social",
      paid: isPaidPlatform(id),
    });
  }

  return slots;
}

/**
 * Does this vault item have any recommendation (primary or alternative) for
 * the given platform?
 */
function postHasPlatform(post: MergedPost, platformId: string): boolean {
  // Legacy posts have primary_platform = "onlyfans" (no destination split).
  // When matching against the new specific OF ids, treat the legacy id as a
  // weak match for onlyfans_wall (default) so old posts still surface.
  const legacyMatches =
    post.primary_platform === "onlyfans" &&
    (platformId === "onlyfans_wall" || platformId === "onlyfans_ppv");
  if (post.primary_platform === platformId || legacyMatches) return true;
  return (post.analysis.alternatives ?? []).some(
    (a) =>
      a.platform === platformId ||
      (a.platform === "onlyfans" &&
        (platformId === "onlyfans_wall" || platformId === "onlyfans_ppv"))
  );
}

/**
 * Score how well a post fits a slot. Higher = better fit. Returns -1 if
 * the post is not eligible at all for this slot.
 */
function scorePostForSlot(post: MergedPost, slot: Slot): number {
  const tier = post.analysis.content_tier ?? 1;

  switch (slot.kind) {
    case "of_free":
    case "fansly_free": {
      // Free promo accounts post Tier 1-2 funnel content. Don't waste
      // paywall-tier (3+) content on a free account.
      if (tier > 2) return -1;
      let s = 100; // baseline for matching tier
      // Bonus if a paid platform is the strategist's primary — means this
      // image was shot for the paid funnel and the free account is the
      // teaser drop. Even better if the matching paid platform is OF/Fansly.
      if (post.primary_platform === slot.platformId) s += 30;
      else if (postHasPlatform(post, slot.platformId)) s += 10;
      // Recency: older pending pieces get a small flush bonus.
      const ageDays = (Date.now() - post.created_at) / (1000 * 60 * 60 * 24);
      s += Math.min(ageDays, 30);
      return s;
    }
    case "of_paid":
    case "fansly_paid": {
      // Paid feed needs Tier 3+ content + the platform actually recommended.
      if (tier < 3) return -1;
      if (!postHasPlatform(post, slot.platformId)) return -1;
      let s = 100;
      if (post.primary_platform === slot.platformId) s += 50;
      // Higher tier = higher value; prioritize.
      s += tier * 10;
      // Existing price signal — let the strategist's pricing nudge order.
      if (post.primary_price_low > 0) s += Math.min(post.primary_price_low, 40);
      const ageDays = (Date.now() - post.created_at) / (1000 * 60 * 60 * 24);
      s += Math.min(ageDays, 20);
      return s;
    }
    case "of_single":
    case "fansly_single": {
      // Single-account mode: any tier works, but match the platform.
      if (!postHasPlatform(post, slot.platformId)) return -1;
      let s = 100;
      if (post.primary_platform === slot.platformId) s += 50;
      s += tier * 5;
      if (post.primary_price_low > 0) s += Math.min(post.primary_price_low, 40);
      const ageDays = (Date.now() - post.created_at) / (1000 * 60 * 60 * 24);
      s += Math.min(ageDays, 20);
      return s;
    }
    case "social": {
      // Social slot: the platform must be in the recommendation set, and
      // (funnel rule) Tier 3+ content should never sit on free social.
      if (!postHasPlatform(post, slot.platformId)) return -1;
      if (tier >= 3 && !slot.paid) return -1;
      let s = 100;
      if (post.primary_platform === slot.platformId) s += 50;
      // Lower tier = better fit for social funnel
      s += (3 - tier) * 5;
      const ageDays = (Date.now() - post.created_at) / (1000 * 60 * 60 * 24);
      s += Math.min(ageDays, 20);
      return s;
    }
  }
}

/**
 * Greedy assignment: each post can fill at most one slot per day so the
 * creator never posts the same image to two places in the same calendar.
 */
function assignSlots(slots: Slot[], pending: MergedPost[]): SlotFill[] {
  const taken = new Set<string>();
  const fills: SlotFill[] = [];
  // Process in slot order — paid OF/Fansly first (highest revenue impact),
  // then social. The slots array is already roughly in this order.
  for (const slot of slots) {
    let best: { post: MergedPost; score: number } | null = null;
    for (const post of pending) {
      if (taken.has(post.id)) continue;
      const score = scorePostForSlot(post, slot);
      if (score < 0) continue;
      if (!best || score > best.score) best = { post, score };
    }
    if (best) {
      taken.add(best.post.id);
      fills.push({ slot, post: best.post });
    } else {
      fills.push({ slot, post: null });
    }
  }
  return fills;
}

export default function TodayPage() {
  const [posts, setPosts] = useState<MergedPost[] | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Re-roll: each click adds the currently-assigned post IDs to this set
  // so the next assignment skips them and surfaces different content.
  // Clears when posts list changes (new vault item could be a better match).
  const [rerolledOut, setRerolledOut] = useState<Set<string>>(new Set());

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
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.enabled && data.profile) setProfile(data.profile as CreatorProfile);
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
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

  const setStatus = async (id: string, status: PostStatus, postedOn?: string) => {
    setPosts((curr) =>
      curr
        ? curr.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status,
                  posted_at: status === "posted" ? new Date().toISOString() : null,
                  posted_on_platform: status === "posted" ? postedOn ?? p.primary_platform : null,
                }
              : p
          )
        : curr
    );
    try {
      await updatePostStatus(id, {
        status,
        posted_on_platform: status === "posted" ? postedOn ?? null : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const today = useMemo(() => {
    if (!posts || !profileLoaded) return null;
    const slots = buildSlots(profile);
    const pending = posts.filter(
      (p) => p.status === "pending" && !rerolledOut.has(p.id)
    );
    const fills = assignSlots(slots, pending);

    const postedToday = posts.filter((p) => {
      if (p.status !== "posted" || !p.posted_at) return false;
      const t = new Date(p.posted_at);
      const d = new Date();
      return t.toDateString() === d.toDateString();
    }).length;

    const filledCount = fills.filter((f) => f.post !== null).length;
    const totalSlots = fills.length;

    // Bonus pieces: pending content not assigned to a slot today, sorted by
    // funnel value. So the creator can see what else is in their backlog.
    const usedIds = new Set(fills.filter((f) => f.post).map((f) => f.post!.id));
    const bonusPool = pending.filter((p) => !usedIds.has(p.id));
    const bonus = bonusPool
      .slice()
      .sort((a, b) => {
        const tierDiff = (b.analysis.content_tier ?? 1) - (a.analysis.content_tier ?? 1);
        if (tierDiff !== 0) return tierDiff;
        return b.primary_price_low - a.primary_price_low;
      })
      .slice(0, 6);

    return {
      fills,
      bonus,
      stats: {
        postedToday,
        filledCount,
        totalSlots,
        backlog: pending.length,
      },
    };
  }, [posts, profile, profileLoaded, rerolledOut]);

  const reroll = () => {
    if (!today) return;
    const currentIds = today.fills
      .map((f) => f.post?.id)
      .filter((id): id is string => Boolean(id));
    setRerolledOut((prev) => {
      const next = new Set(prev);
      for (const id of currentIds) next.add(id);
      return next;
    });
  };

  const resetRerolls = () => setRerolledOut(new Set());

  // ---------- Loading / empty states ----------

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

  if (today && today.fills.length === 0) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Today</h1>
          <p className="hero-sub">
            We don&rsquo;t know which platforms to fill slots for yet. Set your active
            platforms in your profile and we&rsquo;ll build a daily calendar around them.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link href="/settings/profile" className="btn btn-primary">Set up profile</Link>
            <Link href="/" className="btn btn-secondary">Analyze content</Link>
          </div>
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

  if (!today) return null;

  const paidFills = today.fills.filter((f) => f.slot.paid);
  const socialFills = today.fills.filter((f) => !f.slot.paid);

  return (
    <main>
      <header className="today-hero">
        <div>
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>
            Today&rsquo;s plan
          </h1>
          <p className="hero-sub" style={{ margin: 0 }}>
            One slot per platform you actively post on. Tick each off as you post.
          </p>
          <div className="cta-row" style={{ marginTop: 10, gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={reroll}
              disabled={today.stats.filledCount === 0}
              title="Pick different content for each slot. The current items get skipped; next-best matches take their place."
            >
              🎲 New suggestions
            </button>
            {rerolledOut.size > 0 && (
              <button
                className="btn-ghost"
                onClick={resetRerolls}
                title="Bring back items you rolled away"
              >
                Reset re-rolls ({rerolledOut.size} skipped)
              </button>
            )}
          </div>
        </div>
        <div className="today-stats">
          <div className="today-stat">
            <span className="today-stat-num">
              {today.stats.filledCount}<span className="today-stat-num-sub">/{today.stats.totalSlots}</span>
            </span>
            <span className="today-stat-label">Slots filled</span>
          </div>
          <div className="today-stat">
            <span className="today-stat-num">{today.stats.postedToday}</span>
            <span className="today-stat-label">Posted today</span>
          </div>
          <div className="today-stat">
            <span className="today-stat-num">{today.stats.backlog}</span>
            <span className="today-stat-label">In backlog</span>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {paidFills.length > 0 && (
        <section className="slot-section">
          <h2 className="slot-section-title">Paid platforms</h2>
          <div className="slot-grid">
            {paidFills.map((fill) => (
              <SlotCard
                key={fill.slot.id}
                fill={fill}
                thumbUrl={fill.post ? thumbUrls[fill.post.id] : undefined}
                onMarkPosted={() =>
                  fill.post && setStatus(fill.post.id, "posted", fill.slot.platformId)
                }
                onSkip={() => fill.post && setStatus(fill.post.id, "skipped")}
              />
            ))}
          </div>
        </section>
      )}

      {socialFills.length > 0 && (
        <section className="slot-section">
          <h2 className="slot-section-title">Social platforms</h2>
          <div className="slot-grid">
            {socialFills.map((fill) => (
              <SlotCard
                key={fill.slot.id}
                fill={fill}
                thumbUrl={fill.post ? thumbUrls[fill.post.id] : undefined}
                onMarkPosted={() =>
                  fill.post && setStatus(fill.post.id, "posted", fill.slot.platformId)
                }
                onSkip={() => fill.post && setStatus(fill.post.id, "skipped")}
              />
            ))}
          </div>
        </section>
      )}

      {today.bonus.length > 0 && (
        <section className="slot-section">
          <h2 className="slot-section-title">Also in your backlog</h2>
          <p className="slot-section-sub">
            High-value pending pieces that didn&rsquo;t get a slot today — usually because their
            recommended platform isn&rsquo;t in your active list, or another piece won the slot.
          </p>
          <div className="slot-grid">
            {today.bonus.map((post) => (
              <BonusCard
                key={post.id}
                post={post}
                thumbUrl={thumbUrls[post.id]}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ---------- Components ----------

function SlotCard({
  fill,
  thumbUrl,
  onMarkPosted,
  onSkip,
}: {
  fill: SlotFill;
  thumbUrl: string | undefined;
  onMarkPosted: () => void;
  onSkip: () => void;
}) {
  const { slot, post } = fill;
  const composeUrl = platformComposeUrl(slot.platformId);

  if (!post) {
    return (
      <article className="slot-card slot-card-empty">
        <header className="slot-card-header">
          <h3 className="slot-card-title">{slot.title}</h3>
          <p className="slot-card-subtitle">{slot.subtitle}</p>
        </header>
        <div className="slot-empty-body">
          <p>No matching pending content.</p>
          <p className="slot-empty-hint">
            Analyze a piece tagged for {platformName(slot.platformId)} and it&rsquo;ll fill this slot tomorrow.
          </p>
          <Link href="/" className="btn btn-secondary">Analyze content</Link>
        </div>
      </article>
    );
  }

  return (
    <SlotCardFilled
      slot={slot}
      post={post}
      thumbUrl={thumbUrl}
      composeUrl={composeUrl}
      onMarkPosted={onMarkPosted}
      onSkip={onSkip}
    />
  );
}

function SlotCardFilled({
  slot,
  post,
  thumbUrl,
  composeUrl,
  onMarkPosted,
  onSkip,
}: {
  slot: Slot;
  post: MergedPost;
  thumbUrl: string | undefined;
  composeUrl: string | undefined;
  onMarkPosted: () => void;
  onSkip: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const fs = post.analysis.funnel_strategy;

  // For OF/Fansly slots find the recommendation that matches the slot platform
  // (might be primary OR an alternative). For social slots, same.
  const matchedRec =
    post.primary_platform === slot.platformId
      ? post.analysis.primary_recommendation
      : (post.analysis.alternatives ?? []).find((a) => a.platform === slot.platformId) ??
        post.analysis.primary_recommendation;

  const distMode = matchedRec.distribution_mode ?? null;
  const showWallCaption = distMode === "wall" || distMode === "both" || distMode === null;
  const showPpv = (distMode === "ppv" || distMode === "both") && Boolean(matchedRec.ppv_dm_message);

  // Free promo OF/Fansly slot: prefer NOT to recommend the paid OF caption.
  // Use the analysis primary if it's a free-platform alt; otherwise fall back.
  const fullCaption = matchedRec.hashtags?.length
    ? `${matchedRec.caption}\n\n${matchedRec.hashtags.join(" ")}`
    : matchedRec.caption;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const priceLabel =
    matchedRec.pricing_suggestion?.suggested_price
      ? `$${matchedRec.pricing_suggestion.suggested_price}`
      : post.primary_price_low > 0
        ? `$${post.primary_price_low}–$${post.primary_price_high}`
        : null;

  return (
    <article className="slot-card">
      <header className="slot-card-header">
        <div>
          <h3 className="slot-card-title">{slot.title}</h3>
          <p className="slot-card-subtitle">{slot.subtitle}</p>
        </div>
        {fs && <span className="today-card-tier" data-tier={fs.this_image_tier}>T{fs.this_image_tier}</span>}
      </header>

      <div className="slot-card-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" />
        ) : post.remote_image_url ? (
          <img src={post.remote_image_url} alt="" />
        ) : (
          <div className="vault-thumb-placeholder">
            <span>Image on another device</span>
          </div>
        )}
      </div>

      <div className="slot-card-body">
        {distMode && (
          <div className="slot-distribution" data-mode={distMode}>
            <span className="slot-distribution-label">
              {distMode === "wall" ? "Wall post" : distMode === "ppv" ? "PPV in DMs only" : "Wall + PPV"}
            </span>
            {priceLabel && distMode !== "wall" && (
              <span className="slot-distribution-price">{priceLabel}</span>
            )}
          </div>
        )}

        {matchedRec.distribution_rationale && (
          <p className="slot-rationale">{matchedRec.distribution_rationale}</p>
        )}

        {showWallCaption && (
          <div className="slot-caption">
            <span className="slot-caption-label">
              {distMode === "both" ? "Wall caption" : "Caption"}
            </span>
            <p className="caption-block">{matchedRec.caption}</p>
            {matchedRec.hashtags?.length > 0 && (
              <ul className="hashtags">
                {matchedRec.hashtags.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            <button className="btn-ghost" onClick={() => copy(fullCaption)}>
              {copied ? "Copied ✓" : "Copy caption"}
            </button>
          </div>
        )}

        {showPpv && matchedRec.ppv_dm_message && (
          <div className="slot-ppv">
            <span className="slot-caption-label">PPV DM message</span>
            <p className="ppv-dm-text">{matchedRec.ppv_dm_message}</p>
            <button className="btn-ghost" onClick={() => copy(matchedRec.ppv_dm_message!)}>
              Copy DM
            </button>
          </div>
        )}

        <div className="slot-actions">
          {composeUrl && (
            <a
              className="btn-compose"
              href={composeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {platformName(slot.platformId)} →
            </a>
          )}
          <button className="btn btn-primary" onClick={onMarkPosted}>
            ✓ Mark as posted
          </button>
          <button className="btn-ghost btn-danger" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </article>
  );
}

function BonusCard({ post, thumbUrl }: { post: MergedPost; thumbUrl: string | undefined }) {
  const fs = post.analysis.funnel_strategy;
  return (
    <article className="slot-card slot-card-bonus">
      <header className="slot-card-header">
        <div>
          <h3 className="slot-card-title">{platformName(post.primary_platform)}</h3>
          <p className="slot-card-subtitle">{post.analysis.image_summary}</p>
        </div>
        {fs && <span className="today-card-tier" data-tier={fs.this_image_tier}>T{fs.this_image_tier}</span>}
      </header>
      <div className="slot-card-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" />
        ) : post.remote_image_url ? (
          <img src={post.remote_image_url} alt="" />
        ) : (
          <div className="vault-thumb-placeholder">
            <span>Image on another device</span>
          </div>
        )}
      </div>
      <div className="slot-card-body">
        <Link href={`/vault?focus=${encodeURIComponent(post.id)}`} className="btn btn-secondary">
          View in vault
        </Link>
      </div>
    </article>
  );
}

