import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FullResult } from "@/components/ResultCard";

export type VaultPost = {
  id: string;
  created_at: number;
  image_blob: Blob;
  thumb_blob: Blob;
  analysis: FullResult;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
};

export type PostStatus = "pending" | "scheduled" | "posted" | "skipped";

export type RemotePost = {
  id: string;
  created_at: string;
  analysis: FullResult;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
  image_path: string | null;
  image_url: string | null; // signed URL valid for ~1 hour
  source_folder: string | null;
  status: PostStatus;
  posted_at: string | null;
  posted_on_platform: string | null;
  scheduled_for: string | null;
  notes: string | null;
};

export type MergedPost = {
  id: string;
  created_at: number;
  analysis: FullResult;
  content_rating: "SFW" | "suggestive" | "NSFW";
  primary_platform: string;
  primary_price_low: number;
  primary_price_high: number;
  image_blob?: Blob;
  thumb_blob?: Blob;
  remote_image_url?: string | null;
  source: "local" | "remote" | "both";
  // Dropbox parent folder (e.g. "/OF Content/2025-05-12 shoot"). Null
  // for direct-upload posts and for cloud-only posts created before
  // the source_folder column existed (until backfilled).
  source_folder?: string | null;
  status: PostStatus;
  posted_at?: string | null;
  posted_on_platform?: string | null;
  scheduled_for?: string | null;
  notes?: string | null;
};

interface VaultDB extends DBSchema {
  posts: {
    key: string;
    value: VaultPost;
    indexes: {
      by_created: number;
      by_rating: string;
      by_platform: string;
      by_price_low: number;
    };
  };
}

const DB_NAME = "postwise-vault";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VaultDB>> | null = null;

function getDb(): Promise<IDBPDatabase<VaultDB>> {
  if (typeof window === "undefined") {
    throw new Error("Vault is browser-only — IndexedDB not available on the server.");
  }
  if (!dbPromise) {
    dbPromise = openDB<VaultDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("posts", { keyPath: "id" });
        store.createIndex("by_created", "created_at");
        store.createIndex("by_rating", "content_rating");
        store.createIndex("by_platform", "primary_platform");
        store.createIndex("by_price_low", "primary_price_low");
      },
    });
  }
  return dbPromise;
}

export async function savePost(args: {
  imageDataUrl: string;
  analysis: FullResult;
}): Promise<VaultPost> {
  const id = crypto.randomUUID();
  const created_at = Date.now();

  const fullBlob = await dataUrlToBlob(args.imageDataUrl);
  const thumbBlob = await generateThumbnail(args.imageDataUrl, 480);

  const pricing = args.analysis.primary_recommendation.pricing_suggestion;
  const post: VaultPost = {
    id,
    created_at,
    image_blob: fullBlob,
    thumb_blob: thumbBlob,
    analysis: args.analysis,
    content_rating: args.analysis.content_rating,
    primary_platform: args.analysis.primary_recommendation.platform,
    primary_price_low: pricing?.low_usd ?? -1,
    primary_price_high: pricing?.high_usd ?? -1,
  };

  const db = await getDb();
  await db.put("posts", post);

  // Best-effort cloud sync — never fail the local save. Passes the data URL
  // so the server can upload the image to Storage for cross-device access.
  void syncToCloud(post, args.imageDataUrl).catch((err) => console.warn("Cloud sync failed:", err));

  return post;
}

async function syncToCloud(post: VaultPost, imageDataUrl?: string): Promise<void> {
  try {
    const res = await fetch("/api/vault/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: post.id,
        created_at: post.created_at,
        analysis: post.analysis,
        content_rating: post.content_rating,
        primary_platform: post.primary_platform,
        primary_price_low: post.primary_price_low,
        primary_price_high: post.primary_price_high,
        image_data_url: imageDataUrl,
      }),
    });
    // 401 = not signed in (OK), 200 with enabled=false = supabase off (OK)
    if (!res.ok && res.status !== 401) {
      const txt = await res.text();
      console.warn("Cloud sync non-ok:", res.status, txt);
    }
  } catch (err) {
    console.warn("Cloud sync error:", err);
  }
}

export async function fetchCloudPosts(): Promise<{ enabled: boolean; posts: RemotePost[] }> {
  try {
    const res = await fetch("/api/vault/list");
    if (res.status === 401) return { enabled: false, posts: [] };
    if (!res.ok) return { enabled: false, posts: [] };
    const data = await res.json();
    return { enabled: data.enabled ?? false, posts: data.posts ?? [] };
  } catch {
    return { enabled: false, posts: [] };
  }
}

export async function listLocalPosts(): Promise<VaultPost[]> {
  const db = await getDb();
  const all = await db.getAll("posts");
  return all.sort((a, b) => b.created_at - a.created_at);
}

export async function listMergedPosts(): Promise<MergedPost[]> {
  const [local, cloud] = await Promise.all([listLocalPosts(), fetchCloudPosts()]);
  const byId = new Map<string, MergedPost>();
  for (const p of local) {
    // local posts default to pending unless they were synced and we get status back
    byId.set(p.id, { ...p, source: "local", status: "pending" });
  }
  for (const p of cloud.posts) {
    const existing = byId.get(p.id);
    if (existing) {
      // Cloud is the source of truth for status (it's the cross-device record).
      byId.set(p.id, {
        ...existing,
        source: "both",
        remote_image_url: p.image_url ?? undefined,
        source_folder: p.source_folder,
        status: p.status,
        posted_at: p.posted_at,
        posted_on_platform: p.posted_on_platform,
        scheduled_for: p.scheduled_for,
        notes: p.notes,
      });
    } else {
      byId.set(p.id, {
        id: p.id,
        created_at: new Date(p.created_at).getTime(),
        analysis: p.analysis,
        content_rating: p.content_rating,
        primary_platform: p.primary_platform,
        primary_price_low: p.primary_price_low,
        primary_price_high: p.primary_price_high,
        remote_image_url: p.image_url ?? undefined,
        source: "remote",
        source_folder: p.source_folder,
        status: p.status,
        posted_at: p.posted_at,
        posted_on_platform: p.posted_on_platform,
        scheduled_for: p.scheduled_for,
        notes: p.notes,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at);
}

export async function updatePostStatus(
  id: string,
  patch: {
    status?: PostStatus;
    scheduled_for?: string | null;
    posted_on_platform?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  try {
    await fetch(`/api/vault/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.warn("Status update failed:", err);
  }
}

// Backwards-compat alias kept for any callers still using the old name
export const listPosts = listLocalPosts;

export async function deletePost(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("posts", id);
  void deleteFromCloud(id).catch((err) => console.warn("Cloud delete failed:", err));
}

async function deleteFromCloud(id: string): Promise<void> {
  try {
    await fetch(`/api/vault/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}

export async function getPost(id: string): Promise<VaultPost | undefined> {
  const db = await getDb();
  return db.get("posts", id);
}

/**
 * Wipe every local vault entry from IndexedDB. Does NOT touch the cloud
 * (use POST /api/vault/delete-all for that) — call this after the cloud
 * wipe succeeds.
 */
export async function deleteAllLocalPosts(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("posts");
  const tx = db.transaction("posts", "readwrite");
  for (const p of all) {
    await tx.store.delete(p.id);
  }
  await tx.done;
  return all.length;
}

/**
 * Convenience: nuke both cloud + local vault. UI shows a typed-confirmation
 * dialog before this is called.
 */
export async function deleteEntireVault(): Promise<{
  cloud_posts: number;
  cloud_storage: number;
  local_posts: number;
}> {
  const res = await fetch("/api/vault/delete-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE EVERYTHING" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Delete failed (${res.status})`);
  const localCount = await deleteAllLocalPosts();
  return {
    cloud_posts: data.posts_deleted ?? 0,
    cloud_storage: data.storage_files_deleted ?? 0,
    local_posts: localCount,
  };
}

/**
 * Backfill: push every local post to the cloud. Useful right after sign-in to
 * migrate existing local-only entries. Reads the full image from IndexedDB and
 * uploads it as part of the sync payload.
 */
export async function syncAllLocalToCloud(): Promise<number> {
  const local = await listLocalPosts();
  let pushed = 0;
  for (const post of local) {
    try {
      const imageDataUrl = await blobToDataUrl(post.image_blob).catch(() => undefined);
      await fetch("/api/vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          created_at: post.created_at,
          analysis: post.analysis,
          content_rating: post.content_rating,
          primary_platform: post.primary_platform,
          primary_price_low: post.primary_price_low,
          primary_price_high: post.primary_price_high,
          image_data_url: imageDataUrl,
        }),
      });
      pushed++;
    } catch {
      // continue on errors
    }
  }
  return pushed;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function generateThumbnail(dataUrl: string, maxDim: number): Promise<Blob> {
  const img = await loadImage(dataUrl);
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Thumbnail blob creation failed"))),
      "image/jpeg",
      0.8
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}
