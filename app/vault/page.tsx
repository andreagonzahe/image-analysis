"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { listMergedPosts, deletePost, blobToObjectUrl, syncAllLocalToCloud, updatePostStatus, deleteEntireVault, type MergedPost, type PostStatus } from "@/lib/vault";
import { PLATFORMS } from "@/lib/platforms";
import {
  hammingDistance,
  phashFromString,
  HAMMING_SHOOT_THRESHOLD,
} from "@/lib/phash-utils";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/**
 * Trigger a file download for a vault post. Three sources, picked in
 * priority order:
 *   1. Local IndexedDB image_blob (best — original bytes, no network)
 *   2. Dropbox file id → /api/dropbox/file proxy (original bytes from
 *      Dropbox, served as attachment so the browser saves it)
 *   3. Supabase signed image_url → simple <a download> attribute
 *
 * The filename encodes platform + tier + date so the user's Downloads
 * folder is browseable.
 */
function downloadVaultImage(post: MergedPost) {
  const filename = downloadFilenameForPost(post);

  // 1. Local blob (the highest-fidelity source we have).
  if (post.image_blob) {
    const url = URL.createObjectURL(post.image_blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // 2. Dropbox-sourced — go through our full-file download proxy so the
  //    response has Content-Disposition: attachment.
  if (
    (post as MergedPost & { image_source?: string }).image_source === "dropbox" &&
    (post as MergedPost & { image_external_id?: string }).image_external_id
  ) {
    const fileId = (post as MergedPost & { image_external_id: string }).image_external_id;
    window.location.href =
      "/api/dropbox/file/" + encodeURIComponent(fileId) +
      "?filename=" + encodeURIComponent(filename);
    return;
  }

  // 3. Supabase signed URL — use a temp <a> with download attribute.
  if (post.remote_image_url) {
    const a = document.createElement("a");
    a.href = post.remote_image_url;
    a.download = filename;
    a.target = "_blank";
    a.click();
    return;
  }

  alert("Couldn't download — the original image isn't available on this device or in your cloud vault.");
}

function downloadFilenameForPost(post: MergedPost): string {
  const a = post.analysis as { content_tier?: number; primary_recommendation?: { platform?: string } } | null;
  const platform = a?.primary_recommendation?.platform ?? post.primary_platform ?? "post";
  const tier = a?.content_tier ?? "x";
  const date = new Date(post.created_at).toISOString().slice(0, 10);
  return `postwise-${platform}-T${tier}-${date}.jpg`;
}

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
type BodyFilter =
  | "all"
  | "tease"
  | "boobs"
  | "booty"
  | "pussy"
  | "full_nude"
  | "modest";
type ViewMode = "grid" | "shoots" | "categories";

/**
 * Pull the leaf folder name out of a full Dropbox path. The full path
 * is what's stored on the post (so we can disambiguate folders sharing
 * a name); the leaf is what we show in the UI.
 *
 * "/OF Content/2025-05-12 shoot" → "2025-05-12 shoot"
 * "/OF Content"                   → "OF Content"
 * "/"                             → "Root"
 */
function leafFolderName(fullPath: string | null | undefined): string {
  if (!fullPath) return "Direct uploads";
  if (fullPath === "/" || fullPath === "") return "Root";
  const idx = fullPath.lastIndexOf("/");
  if (idx < 0) return fullPath;
  return fullPath.slice(idx + 1) || "Root";
}

const SHOOT_TIME_WINDOW_MS = 36 * 60 * 60 * 1000; // 36h — same shoot day

type ShootGroup = {
  id: string;
  label: string;
  subtitle: string;
  items: MergedPost[];
  cover: MergedPost;
  source_folder: string | null;
};

/**
 * Group posts into "shoots" — clusters of photos that were taken in
 * the same session (same outfit, same background, different poses).
 *
 * Three signals, layered most-trusted to weakest:
 *   1. Same Dropbox source_folder + within 36h → same shoot. The user's
 *      own folder organization is a strong signal of intentional
 *      grouping; we honor it but cap at 36h so a re-used folder that
 *      holds multiple sessions still splits sensibly.
 *   2. Visual similarity (Hamming ≤ 28) + within 36h → same shoot.
 *      Catches the "user dumped 3 shoots into one folder" case AND
 *      the "shoots split across multiple folders" case.
 *   3. Otherwise: each post is its own cluster (legacy posts without
 *      phash that don't share a folder either).
 *
 * Union-find over a created_at-sorted list so each post only compares
 * against neighbors within the time window — keeps the algorithm
 * tractable for vaults with thousands of posts.
 */
function clusterShoots(posts: MergedPost[]): ShootGroup[] {
  if (posts.length === 0) return [];

  // Sort newest-first so the cover thumbnail of each cluster is its
  // freshest member, and so the time-window check is monotonic.
  const sorted = [...posts].sort((a, b) => b.created_at - a.created_at);

  // Union-find over post ids.
  const parent: Record<string, string> = {};
  for (const p of sorted) parent[p.id] = p.id;
  const find = (id: string): string => {
    let cur = id;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Decode each post's pHash once.
  const decoded = sorted.map((p) => {
    let hash: bigint | null = null;
    if (typeof p.phash === "string" && p.phash.length === 16) {
      try {
        hash = phashFromString(p.phash);
      } catch {
        hash = null;
      }
    }
    return { post: p, hash };
  });

  for (let i = 0; i < decoded.length; i++) {
    const a = decoded[i];
    for (let j = i + 1; j < decoded.length; j++) {
      const b = decoded[j];
      // Sorted desc — once we leave the window, all later posts are also out.
      if (a.post.created_at - b.post.created_at > SHOOT_TIME_WINDOW_MS) break;

      // Signal 1: shared source folder is enough.
      const sameFolder =
        a.post.source_folder &&
        a.post.source_folder === b.post.source_folder;
      if (sameFolder) {
        union(a.post.id, b.post.id);
        continue;
      }

      // Signal 2: visual similarity.
      if (a.hash && b.hash) {
        const dist = hammingDistance(a.hash, b.hash);
        if (dist <= HAMMING_SHOOT_THRESHOLD) {
          union(a.post.id, b.post.id);
        }
      }
    }
  }

  // Collect into clusters.
  const groups = new Map<string, MergedPost[]>();
  for (const p of sorted) {
    const root = find(p.id);
    const list = groups.get(root) ?? [];
    list.push(p);
    groups.set(root, list);
  }

  // Build labels. Prefer the source_folder leaf when the cluster
  // shares one; fall back to a human-readable date span.
  const result: ShootGroup[] = [];
  for (const [root, items] of groups.entries()) {
    items.sort((a, b) => b.created_at - a.created_at);
    const folders = new Set(items.map((p) => p.source_folder ?? "").filter(Boolean));
    const shared = folders.size === 1 ? Array.from(folders)[0] : null;

    const newest = items[0];
    const oldest = items[items.length - 1];
    const dateLabel = formatShootDateLabel(newest.created_at, oldest.created_at);

    let label: string;
    let subtitle: string;
    if (shared) {
      label = leafFolderName(shared);
      subtitle = `${dateLabel} · ${items.length} photo${items.length === 1 ? "" : "s"}`;
    } else if (folders.size === 0) {
      // No Dropbox folder anywhere in this cluster (direct uploads).
      label = dateLabel;
      subtitle = `${items.length} direct upload${items.length === 1 ? "" : "s"}`;
    } else {
      // Cluster spans multiple Dropbox folders — visual similarity grouped
      // them, so name it by date. Reasonable when the user has chaotic org.
      label = dateLabel;
      subtitle = `${items.length} photos · spans ${folders.size} folder${folders.size === 1 ? "" : "s"}`;
    }

    result.push({
      id: root,
      label,
      subtitle,
      items,
      cover: items[0],
      source_folder: shared,
    });
  }

  // Biggest shoots first; tie-break by most-recent activity.
  result.sort((a, b) => {
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    return b.cover.created_at - a.cover.created_at;
  });
  return result;
}

function formatShootDateLabel(newestMs: number, oldestMs: number): string {
  const d = new Date(newestMs);
  const same = newestMs === oldestMs || newestMs - oldestMs < 24 * 60 * 60 * 1000;
  if (same) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const o = new Date(oldestMs);
  // Same month/year → "May 12-14, 2026"; cross-month → "May 28 – Jun 1, 2026"
  const sameMonth = d.getMonth() === o.getMonth() && d.getFullYear() === o.getFullYear();
  if (sameMonth) {
    return `${d.toLocaleDateString(undefined, { month: "short" })} ${o.getDate()}–${d.getDate()}, ${d.getFullYear()}`;
  }
  return `${o.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

// Mutually-exclusive body categories. Every post lands in exactly one,
// picked by priority (the most explicit category wins). Drives both the
// filter chips and the "Categories" folder view.
const BODY_CATEGORY_ORDER: Array<{
  key: Exclude<BodyFilter, "all">;
  label: string;
  description: string;
}> = [
  { key: "tease",     label: "Tease",     description: "Lingerie, swimwear or sensual framing — no explicit nudity." },
  { key: "boobs",     label: "Boobs",     description: "Breasts or cleavage visible." },
  { key: "booty",     label: "Booty",     description: "Butt visible — any garment level including thong." },
  { key: "pussy",     label: "Pussy",     description: "Genitals visible but not fully nude — tier 4." },
  { key: "full_nude", label: "Full nude", description: "Fully naked — tier 4-5, PPV only." },
  { key: "modest",    label: "Modest",    description: "Fully clothed or athletic — no body parts visible." },
];

/**
 * Derive "what's showing" categories from the captioner's tags.
 *
 * Returns both:
 *   - flags: which categories the post belongs to (a post can be both
 *            boobs + booty if both are visible)
 *   - primary: the SINGLE most-explicit category, used for the
 *              "Categories" folder view where each post should land in
 *              exactly one bucket
 *
 * Priority for primary (most-explicit wins, picking up earlier stops):
 *   full_nude > pussy > booty > boobs > tease > modest
 *
 * Notes:
 *   - "full_nude" = attire fully_nude (whole body uncovered)
 *   - "pussy" = genitals visible but NOT fully nude (e.g. spread legs
 *               while wearing thong-aside; lower-body explicit only)
 *   - "booty" = butt visible; includes thong-back shots and the
 *               heuristic for swimwear/lingerie + seductive pose
 *   - "boobs" = breasts or cleavage visible (or topless / partial nude)
 *   - "tease" = suggestive attire/sensuality but no explicit body parts
 *   - "modest" = none of the above
 */
type BodyCategoryKey = Exclude<BodyFilter, "all">;
function deriveBodyCategories(post: MergedPost): {
  flags: {
    boobs: boolean;
    booty: boolean;
    pussy: boolean;
    fullNude: boolean;
    tease: boolean;
    modest: boolean;
  };
  primary: BodyCategoryKey;
} {
  const empty = {
    flags: { boobs: false, booty: false, pussy: false, fullNude: false, tease: false, modest: true },
    primary: "modest" as BodyCategoryKey,
  };
  const tags = (post.analysis as {
    tags?: {
      attire?: string;
      body_parts_visible?: string[];
      sensuality?: string;
      pose_intent?: string;
    };
  })?.tags;
  if (!tags) return empty;

  const parts = new Set(tags.body_parts_visible ?? []);
  const attire = tags.attire ?? "unknown";
  const sensuality = tags.sensuality ?? "unknown";
  const poseIntent = tags.pose_intent ?? "unknown";

  const fullNude = attire === "fully_nude";

  // Pussy: genitals tagged, but reserved for the not-fully-nude case
  // (otherwise it'd double-count with full_nude in the primary bucket).
  const pussy = parts.has("genitals") && !fullNude;

  const boobs =
    parts.has("breasts") ||
    parts.has("cleavage") ||
    attire === "topless" ||
    attire === "partial_nude" ||
    fullNude;

  // Booty — direct tag, fully nude, or revealing-attire posed shots
  // where the back is plausibly visible.
  const booty =
    parts.has("buttocks") ||
    fullNude ||
    ((attire === "lingerie" ||
      attire === "underwear" ||
      attire === "swimwear" ||
      attire === "partial_nude") &&
      (poseIntent === "modeling_seductive" ||
        sensuality === "erotic_intentional"));

  // Tease — suggestive without explicit body parts.
  const tease =
    !boobs && !booty && !pussy && !fullNude &&
    (attire === "lingerie" ||
      attire === "underwear" ||
      attire === "swimwear" ||
      sensuality === "erotic_intentional" ||
      sensuality === "sensual_aesthetic" ||
      poseIntent === "modeling_seductive");

  const modest = !boobs && !booty && !pussy && !fullNude && !tease;

  // Pick primary in priority order (most-explicit wins).
  let primary: BodyCategoryKey = "modest";
  if (fullNude) primary = "full_nude";
  else if (pussy) primary = "pussy";
  else if (booty) primary = "booty";
  else if (boobs) primary = "boobs";
  else if (tease) primary = "tease";

  return {
    flags: { boobs, booty, pussy, fullNude, tease, modest },
    primary,
  };
}

type AuthState = { auth_enabled: boolean; sync_enabled: boolean; signed_in: boolean };

export default function VaultPage() {
  const [posts, setPosts] = useState<MergedPost[] | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [bodyFilter, setBodyFilter] = useState<BodyFilter>("all");
  const [folderFilter, setFolderFilter] = useState<string | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");
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
  const [junkScan, setJunkScan] = useState<{
    total_scanned: number;
    screenshot_count: number;
    nonhuman_count: number;
    duplicate_remove_count: number;
    suggested_delete_count: number;
    screenshots: Array<{ id: string }>;
    nonhumans: Array<{ id: string }>;
    duplicate_clusters: Array<{ keep_id: string; remove_ids: string[] }>;
  } | null>(null);
  const [junkRunning, setJunkRunning] = useState(false);
  const [junkMsg, setJunkMsg] = useState<string | null>(null);

  const scanJunk = async () => {
    setJunkRunning(true);
    setJunkMsg(null);
    try {
      const res = await fetch("/api/vault/scan-junk");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setJunkScan(data);
    } catch (e) {
      setJunkMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setJunkRunning(false);
    }
  };

  const removeJunk = async () => {
    if (!junkScan) return;
    const toDelete = [
      ...junkScan.screenshots.map((s) => s.id),
      ...junkScan.nonhumans.map((n) => n.id),
      ...junkScan.duplicate_clusters.flatMap((c) => c.remove_ids),
    ];
    if (toDelete.length === 0) return;
    if (!confirm(`Delete ${toDelete.length} junk post(s)? This can't be undone.`)) return;
    setJunkRunning(true);
    setJunkMsg(null);
    try {
      const res = await fetch("/api/vault/delete-junk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_ids: toDelete, confirm: "REMOVE JUNK" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setJunkMsg(`Removed ${data.posts_deleted} post${data.posts_deleted === 1 ? "" : "s"}.`);
      setJunkScan(null);
      const fresh = await listMergedPosts();
      setPosts(fresh);
    } catch (e) {
      setJunkMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setJunkRunning(false);
    }
  };

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

  // Cluster posts into "shoots" using a blend of three signals so the
  // grouping survives whatever organization (or chaos) is in the user's
  // Dropbox. See clusterShoots() at the top of this file for the full
  // algorithm. Each group becomes a folder card in the "Shoots" view.
  // Defined BEFORE `filtered` so the folder-filter check can resolve
  // a shoot id → its post ids via shootGroupsById.
  const shootGroups = useMemo(() => {
    if (!posts) return [];
    return clusterShoots(posts);
  }, [posts]);

  // Reverse lookup so the filter can resolve a shoot id → its post ids
  // in O(1). Rebuilt whenever shootGroups changes.
  const shootGroupsById = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const g of shootGroups) {
      m.set(g.id, new Set(g.items.map((p) => p.id)));
    }
    return m;
  }, [shootGroups]);

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
    if (bodyFilter !== "all") {
      out = out.filter((p) => {
        const { primary } = deriveBodyCategories(p);
        return primary === bodyFilter;
      });
    }
    if (folderFilter !== "all") {
      // folderFilter holds a shoot-cluster id (the root of the union-find
      // grouping). Resolve it to its member post ids and filter by
      // membership — works for both single-folder clusters and the
      // multi-folder visual-similarity clusters that don't map to one
      // physical source_folder.
      const ids = shootGroupsById.get(folderFilter);
      if (ids) out = out.filter((p) => ids.has(p.id));
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
  }, [posts, ratingFilter, platformFilter, sourceFilter, statusFilter, bodyFilter, folderFilter, shootGroupsById, sort]);

  // Aggregate posts by body category for the "Categories" folder view.
  // Now uses the mutually-exclusive `primary` so every post lands in
  // exactly one folder — much less confusing than the old multi-flag
  // bucketing where one post could appear in 3 folders.
  const categoryGroups = useMemo(() => {
    if (!posts) return [];
    const buckets: Record<Exclude<BodyFilter, "all">, MergedPost[]> = {
      tease: [],
      boobs: [],
      booty: [],
      pussy: [],
      full_nude: [],
      modest: [],
    };
    for (const p of posts) {
      const { primary } = deriveBodyCategories(p);
      buckets[primary].push(p);
    }
    for (const k of Object.keys(buckets) as Array<Exclude<BodyFilter, "all">>) {
      buckets[k].sort((a, b) => b.created_at - a.created_at);
    }
    return BODY_CATEGORY_ORDER.map((meta) => ({
      ...meta,
      items: buckets[meta.key],
      cover: buckets[meta.key][0],
    })).filter((g) => g.items.length > 0);
  }, [posts]);

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
          <div className="vault-view-tabs" role="tablist" aria-label="Vault view">
            <button
              role="tab"
              aria-selected={view === "grid"}
              className={`vault-view-tab${view === "grid" ? " is-active" : ""}`}
              onClick={() => setView("grid")}
            >
              <span className="vault-view-tab-icon" aria-hidden>🖼️</span>
              All photos
              <span className="vault-view-tab-count">{posts.length.toLocaleString()}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === "shoots"}
              className={`vault-view-tab${view === "shoots" ? " is-active" : ""}`}
              onClick={() => setView("shoots")}
            >
              <span className="vault-view-tab-icon" aria-hidden>📁</span>
              Shoots
              <span className="vault-view-tab-count">{shootGroups.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === "categories"}
              className={`vault-view-tab${view === "categories" ? " is-active" : ""}`}
              onClick={() => setView("categories")}
            >
              <span className="vault-view-tab-icon" aria-hidden>📁</span>
              Body parts
              <span className="vault-view-tab-count">{categoryGroups.length}</span>
            </button>
          </div>

          {folderFilter !== "all" && view === "grid" && (
            <div className="vault-folder-pill">
              <span>
                <span aria-hidden>📁</span> Viewing folder:{" "}
                <strong>
                  {shootGroupsById.has(folderFilter)
                    ? shootGroups.find((g) => g.id === folderFilter)?.label ?? "Folder"
                    : "Folder"}
                </strong>
              </span>
              <button
                className="btn-ghost"
                onClick={() => setFolderFilter("all")}
                aria-label="Clear folder filter"
              >
                ✕ Back to all folders
              </button>
            </div>
          )}

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
            <div className="chip-row">
              <Chip active={bodyFilter === "all"} onClick={() => setBodyFilter("all")}>Anything showing</Chip>
              <Chip active={bodyFilter === "tease"} onClick={() => setBodyFilter("tease")}>Tease</Chip>
              <Chip active={bodyFilter === "boobs"} onClick={() => setBodyFilter("boobs")}>Boobs</Chip>
              <Chip active={bodyFilter === "booty"} onClick={() => setBodyFilter("booty")}>Booty</Chip>
              <Chip active={bodyFilter === "pussy"} onClick={() => setBodyFilter("pussy")}>Pussy</Chip>
              <Chip active={bodyFilter === "full_nude"} onClick={() => setBodyFilter("full_nude")}>Full nude</Chip>
              <Chip active={bodyFilter === "modest"} onClick={() => setBodyFilter("modest")}>Modest</Chip>
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

          {view === "shoots" ? (
            shootGroups.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
                No shoots yet. Import a Dropbox folder to start organizing.
              </p>
            ) : (
              <>
                <p className="vault-folder-help">
                  Folders below group photos taken in the same session —
                  same outfit, same background, different poses. Click any
                  folder to open it. Photos still appear in <strong>All
                  photos</strong> too.
                </p>
                <div className="vault-folder-grid">
                  {shootGroups.map((g) => (
                    <FolderCard
                      key={g.id}
                      title={g.label}
                      subtitle={g.subtitle}
                      count={g.items.length}
                      cover={g.cover}
                      thumbUrl={g.cover ? thumbUrls[g.cover.id] : undefined}
                      onOpen={() => {
                        setFolderFilter(g.id);
                        setView("grid");
                      }}
                    />
                  ))}
                </div>
              </>
            )
          ) : view === "categories" ? (
            categoryGroups.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
                No tagged posts yet.
              </p>
            ) : (
              <>
                <p className="vault-folder-help">
                  Each post lands in exactly one folder — the most-explicit
                  body part visible wins. Click a folder to filter the grid.
                </p>
                <div className="vault-folder-grid">
                  {categoryGroups.map((g) => (
                    <FolderCard
                      key={g.key}
                      title={g.label}
                      subtitle={g.description}
                      count={g.items.length}
                      cover={g.cover}
                      thumbUrl={g.cover ? thumbUrls[g.cover.id] : undefined}
                      onOpen={() => {
                        setBodyFilter(g.key);
                        setView("grid");
                      }}
                    />
                  ))}
                </div>
              </>
            )
          ) : filtered.length === 0 ? (
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
                  <h3 className="vault-cleanup-title">Find screenshots, non-humans + duplicates</h3>
                  <p className="vault-cleanup-body">
                    Catches what the prefilter missed — screenshots of apps / listings / chats,
                    animal &amp; non-human content (pets, food, scenery, plushies) where the
                    captioner&rsquo;s subject isn&rsquo;t a person, plus near-duplicate burst
                    shots that landed as separate vault entries. Screenshots + non-humans
                    detected from saved captions; duplicates detected by perceptual-hashing
                    the Dropbox thumbnail.
                  </p>
                  {junkScan && (
                    <p className="vault-cleanup-body" style={{ marginTop: 8 }}>
                      <strong>Scanned {junkScan.total_scanned.toLocaleString()} post{junkScan.total_scanned === 1 ? "" : "s"}:</strong>{" "}
                      {junkScan.screenshot_count} screenshot{junkScan.screenshot_count === 1 ? "" : "s"} ·{" "}
                      {junkScan.nonhuman_count} non-human{junkScan.nonhuman_count === 1 ? "" : "s"} ·{" "}
                      {junkScan.duplicate_remove_count} duplicate{junkScan.duplicate_remove_count === 1 ? "" : "s"}{" "}
                      ({junkScan.duplicate_clusters.length} cluster{junkScan.duplicate_clusters.length === 1 ? "" : "s"}).{" "}
                      <strong>Total to remove: {junkScan.suggested_delete_count}.</strong>
                    </p>
                  )}
                  {junkMsg && (
                    <p className="vault-cleanup-body" style={{ marginTop: 8, color: "var(--accent-strong)" }}>{junkMsg}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!junkScan ? (
                    <button className="btn btn-secondary" onClick={scanJunk} disabled={junkRunning}>
                      {junkRunning ? "Scanning…" : "Scan for junk + duplicates"}
                    </button>
                  ) : junkScan.suggested_delete_count > 0 ? (
                    <>
                      <button className="btn btn-danger" onClick={removeJunk} disabled={junkRunning}>
                        {junkRunning ? "Removing…" : `Remove ${junkScan.suggested_delete_count.toLocaleString()} post${junkScan.suggested_delete_count === 1 ? "" : "s"}`}
                      </button>
                      <button className="btn-ghost" onClick={() => { setJunkScan(null); setJunkMsg(null); }} disabled={junkRunning}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => { setJunkScan(null); setJunkMsg(null); }}>
                      Clean — rescan
                    </button>
                  )}
                </div>
              </section>

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

/**
 * Folder-style card for the "By shoot" and "By body part" views. Shows
 * a cover thumbnail (the freshest post in the group), the folder name,
 * a one-line subtitle, and the post count. Click to drill into the
 * flat grid filtered to just those posts.
 */
function FolderCard({
  title,
  subtitle,
  count,
  cover,
  thumbUrl,
  onOpen,
}: {
  title: string;
  subtitle: string;
  count: number;
  cover: MergedPost | undefined;
  thumbUrl?: string;
  onOpen: () => void;
}) {
  const remoteUrl =
    cover && (cover as MergedPost & { image_url?: string | null }).image_url;
  const imgSrc = thumbUrl ?? cover?.remote_image_url ?? remoteUrl ?? null;
  return (
    <button className="vault-folder-card" onClick={onOpen} aria-label={`Open folder: ${title}`}>
      {/* Folder tab — the angled flap at the top sells the "this is a
          folder" metaphor at a glance. Purely decorative. */}
      <div className="vault-folder-tab" aria-hidden />
      <div className="vault-folder-thumb">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt="" loading="lazy" />
        ) : (
          <div className="vault-folder-thumb-empty" aria-hidden>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            </svg>
          </div>
        )}
        <span className="vault-folder-count" aria-label={`${count} photos`}>
          {count.toLocaleString()}
        </span>
        <span className="vault-folder-icon" aria-hidden>📁</span>
      </div>
      <div className="vault-folder-body">
        <strong className="vault-folder-title">{title}</strong>
        <span className="vault-folder-subtitle">{subtitle}</span>
      </div>
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
  const { primary: bodyPrimary } = deriveBodyCategories(post);
  // Corner badge — single category per post, taken from the same
  // mutually-exclusive primary that drives the Categories folder view.
  const BADGE_FOR_PRIMARY: Record<Exclude<BodyFilter, "all">, { label: string; className: string } | null> = {
    full_nude: { label: "Full nude", className: "body-badge body-badge-explicit" },
    pussy:     { label: "Pussy",     className: "body-badge body-badge-explicit" },
    booty:     { label: "Booty",     className: "body-badge body-badge-bottom" },
    boobs:     { label: "Boobs",     className: "body-badge body-badge-top" },
    tease:     { label: "Tease",     className: "body-badge body-badge-lingerie" },
    modest:    null,
  };
  const bodyBadge = BADGE_FOR_PRIMARY[bodyPrimary];
  const bodyLabel = bodyBadge?.label ?? null;
  const bodyClass = bodyBadge?.className ?? "";

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
        {bodyLabel && <span className={bodyClass}>{bodyLabel}</span>}
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
          <button
            className="btn-ghost"
            onClick={() => downloadVaultImage(post)}
            title="Save the original image to your computer"
          >
            ⬇ Download
          </button>
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
