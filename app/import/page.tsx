"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";

type DropboxStatus = {
  configured: boolean;
  signed_in?: boolean;
  connected: boolean;
  account?: { email: string | null; name: string | null } | null;
};

type FolderEntry = { id: string; name: string; path: string };

type FolderListing = {
  path: string;
  folders: FolderEntry[];
  counts: { images: number; total: number };
  account?: { email: string | null; name: string | null } | null;
};

type Forecast = {
  count: number;
  total_bytes: number;
};

// Cost model — keep these in lockstep with /lib/prefilter + /lib/captioner
const PREFILTER_COST = 0.001;   // per image
const ANALYZE_COST = 0.005;     // per image
const KEEPER_RATIO = 0.28;      // historical estimate; we assume ~28% survives prefilter

export default function ImportPage() {
  return (
    <Suspense fallback={<main><header className="hero"><h1 className="title">Loading…</h1></header></main>}>
      <ImportPageInner />
    </Suspense>
  );
}

function ImportPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMessage = params.get("message");
  const dropboxConnected = params.get("dropbox_connected") === "1";

  const [status, setStatus] = useState<DropboxStatus | null>(null);
  const [path, setPath] = useState<string>("");
  const [pathInput, setPathInput] = useState<string>("");
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);

  useEffect(() => {
    fetch("/api/dropbox/status")
      .then((r) => r.json())
      .then((s) => setStatus(s))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [dropboxConnected]);

  useEffect(() => {
    if (!status?.connected) return;
    loadFolder(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, path]);

  const loadFolder = async (p: string) => {
    setLoadingFolder(true);
    setError(null);
    setForecast(null);
    try {
      const res = await fetch(`/api/dropbox/folders?path=${encodeURIComponent(p || "/")}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not list folder");
      setListing(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFolder(false);
    }
  };

  const scanForForecast = async (p: string) => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/dropbox/folder/contents?path=${encodeURIComponent(p || "/")}&max=10000`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not scan folder");
      setForecast({ count: data.count, total_bytes: data.total_bytes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Dropbox? You'll need to reconnect to import again.")) return;
    setError(null);
    try {
      const res = await fetch("/api/dropbox/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      setStatus({ ...(status as DropboxStatus), connected: false, account: null });
      setListing(null);
      setForecast(null);
      setPath("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startImport = async () => {
    if (!forecast || forecast.count === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || "/" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      router.push(`/import/status/${data.batch_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  // Gating UI
  if (!status) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Bulk import</h1>
          <p className="hero-sub">Loading…</p>
        </header>
      </main>
    );
  }

  if (!status.configured) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Bulk import</h1>
          <p className="hero-sub">
            Dropbox isn&rsquo;t configured. Add <code>DROPBOX_APP_KEY</code>,{" "}
            <code>DROPBOX_APP_SECRET</code>, and <code>DROPBOX_REDIRECT_URI</code> to{" "}
            <code>.env.local</code> to enable bulk import.
          </p>
        </header>
      </main>
    );
  }

  if (!status.signed_in) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Bulk import</h1>
          <p className="hero-sub">
            Bulk import saves the analyses to your account so they sync across devices.
            Sign in first — takes 30 seconds.
          </p>
        </header>
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 24 }}>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/import"
            signUpForceRedirectUrl="/import"
            appearance={{
              elements: {
                rootBox: { display: "inline-block" },
                button: {
                  background: "var(--accent)",
                  color: "white",
                  border: 0,
                  padding: "12px 22px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                },
              },
            }}
          />
          <Link href="/" className="btn btn-secondary">
            Or analyze a single image without signing in
          </Link>
        </div>
      </main>
    );
  }

  if (!status.connected) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Connect Dropbox</h1>
          <p className="hero-sub">
            One-time authorization. Your Dropbox tokens are stored server-side on your own Supabase
            project — we use them to fetch images for analysis and never expose them to anyone else.
            You can disconnect at any time.
          </p>
        </header>
        {error && <div className="error-banner">{error}</div>}
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 32 }}>
          <a className="btn btn-primary" href="/api/dropbox/connect">
            Connect Dropbox
          </a>
        </div>
      </main>
    );
  }

  // Connected — folder picker
  const breadcrumbs = (path || "/").split("/").filter(Boolean);
  const parentPath =
    !path || path === "/" ? null : "/" + breadcrumbs.slice(0, -1).join("/");

  const cost = forecast
    ? {
        prefilter: forecast.count * PREFILTER_COST,
        prefilter_total: forecast.count * PREFILTER_COST,
        est_keepers: Math.round(forecast.count * KEEPER_RATIO),
        analyze_total: Math.round(forecast.count * KEEPER_RATIO) * ANALYZE_COST,
      }
    : null;
  const totalCost = cost ? cost.prefilter_total + cost.analyze_total : 0;

  return (
    <main>
      <header className="hero">
        <h1 className="title">
          Import from <span className="title-accent">Dropbox</span>
        </h1>
        <p className="hero-sub">
          Point us at the folder where your photos live. We&rsquo;ll skip past
          screenshots, receipts, and random non-content photos automatically,
          then analyze and sort the ones worth keeping. You can close this tab —
          everything runs in the background and your vault will be ready when you check back.
        </p>
        {status.account?.email && (
          <p className="hero-sub" style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            Connected to {status.account.email}
            <button className="btn-ghost" style={{ fontSize: 12, padding: "3px 10px" }} onClick={disconnect}>
              Disconnect
            </button>
          </p>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="import-breadcrumbs">
          <button className="btn-ghost" onClick={() => setPath("")}>Your Dropbox</button>
          {breadcrumbs.map((b, i) => (
            <span key={i} className="import-crumb">
              <span className="import-crumb-sep">/</span>
              <button className="btn-ghost" onClick={() => setPath("/" + breadcrumbs.slice(0, i + 1).join("/"))}>
                {b}
              </button>
            </span>
          ))}
        </div>

        {loadingFolder ? (
          <p style={{ color: "var(--muted)" }}>Loading folder…</p>
        ) : listing ? (
          <>
            <div className="import-counts">
              <div>
                <span className="import-count-num">{listing.counts.images}</span>
                <span className="import-count-label">photos in this folder</span>
              </div>
              <div>
                <span className="import-count-num">{listing.folders.length}</span>
                <span className="import-count-label">folders inside</span>
              </div>
            </div>

            {parentPath !== null && (
              <button className="folder-row folder-row-parent" onClick={() => setPath(parentPath)}>
                <span className="folder-icon">↑</span>
                <span>Back to {breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : "your Dropbox"}</span>
              </button>
            )}

            {listing.folders.length === 0 && listing.counts.images === 0 && (
              <div className="import-empty">
                <p className="import-empty-title">Nothing in this folder.</p>
                {(!path || path === "/") ? (
                  <>
                    <p className="import-empty-body">
                      A couple of common reasons your Dropbox looks empty here:
                    </p>
                    <ol className="import-empty-list">
                      <li>
                        <strong>The app only has access to a single folder.</strong> If
                        you picked &ldquo;App folder&rdquo; when first connecting, we can only
                        see one specific folder inside your Dropbox — not everything. Easiest
                        fix: disconnect, then reconnect using a Dropbox app with full access.
                      </li>
                      <li>
                        <strong>Your photos live in a sub-folder.</strong> Common
                        places: Photos, Camera Uploads, or a folder named after a shoot.
                        Type that folder name in the box below to jump straight there.
                      </li>
                    </ol>
                  </>
                ) : (
                  <p className="import-empty-body">
                    No photos or folders inside <code>{path}</code>. Try going back up a level
                    or type a different folder name below.
                  </p>
                )}
              </div>
            )}

            <form
              className="import-pathjump"
              onSubmit={(e) => {
                e.preventDefault();
                let p = pathInput.trim();
                if (p && !p.startsWith("/")) p = "/" + p;
                setPath(p);
                setPathInput("");
              }}
            >
              <label className="import-pathjump-label">Jump to path</label>
              <div className="import-pathjump-row">
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="/Photos/2026"
                />
                <button type="submit" className="btn btn-secondary">Go</button>
              </div>
              <p className="import-pathjump-hint">
                Dropbox paths are case-sensitive. Common ones: <code>/Camera Uploads</code>,{" "}
                <code>/Photos</code>, <code>/Apps</code>.
              </p>
            </form>


            {listing.folders.map((f) => (
              <button key={f.id} className="folder-row" onClick={() => setPath(f.path)}>
                <span className="folder-icon">📁</span>
                <span className="folder-name">{f.name}</span>
                <span className="folder-arrow">→</span>
              </button>
            ))}

            <div className="cta-row" style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                onClick={() => scanForForecast(path)}
                disabled={scanning}
              >
                {scanning ? "Scanning…" : `Scan "${path || "/"}" recursively`}
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--muted)" }}>Tap a folder above to look inside.</p>
        )}
      </div>

      {forecast && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 className="forecast-title">Cost forecast</h2>
          <p className="forecast-sub">
            We found <strong>{forecast.count.toLocaleString()}</strong> image{forecast.count === 1 ? "" : "s"} in{" "}
            <code>{path || "/"}</code> ({prettyBytes(forecast.total_bytes)}).
          </p>

          <div className="forecast-grid">
            <div className="forecast-row">
              <span className="forecast-label">Step 1: Pre-filter</span>
              <span className="forecast-value">~${cost!.prefilter_total.toFixed(2)}</span>
              <span className="forecast-meta">{forecast.count.toLocaleString()} × ${PREFILTER_COST}</span>
            </div>
            <div className="forecast-row">
              <span className="forecast-label">Estimated keepers</span>
              <span className="forecast-value">~{cost!.est_keepers.toLocaleString()}</span>
              <span className="forecast-meta">{Math.round(KEEPER_RATIO * 100)}% historical ratio</span>
            </div>
            <div className="forecast-row">
              <span className="forecast-label">Step 2: Deep-tag keepers</span>
              <span className="forecast-value">~${cost!.analyze_total.toFixed(2)}</span>
              <span className="forecast-meta">{cost!.est_keepers.toLocaleString()} × ${ANALYZE_COST}</span>
            </div>
            <div className="forecast-row forecast-row-total">
              <span className="forecast-label">Total Replicate spend (estimate)</span>
              <span className="forecast-value">~${totalCost.toFixed(2)}</span>
              <span className="forecast-meta">on your own Replicate account</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", margin: "16px 0 0" }}>
            Time: roughly <strong>{humanizeDuration(forecast.count)}</strong>.
            The faster end assumes you keep the import status tab open
            (work runs continuously); the slower end assumes you close it and
            let the scheduler chip away every minute. The live status page
            shows a real countdown once jobs start completing.
          </p>

          <div className="cta-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={startImport} disabled={submitting}>
              {submitting ? "Starting…" : `Start import of ${forecast.count.toLocaleString()} images`}
            </button>
            <Link href="/import" className="btn btn-secondary">Cancel</Link>
          </div>
        </div>
      )}

      <p className="privacy-line" style={{ marginTop: 20 }}>
        <span className="privacy-dot" aria-hidden /> Your photos never leave Dropbox.
        We point to your files in your account — we don&rsquo;t copy or store them anywhere else. Each time we need to look at one we ask Dropbox for a short-lived link that expires quickly.
      </p>
    </main>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function humanizeDuration(count: number): string {
  // Two regimes:
  // - Fast: import status page open in dev (chain-fired cron) — limited by
  //   Replicate response time only. ~1.5s per image effective (prefilter
  //   ~0.6s/image @ 5-parallel + 28% keepers × ~2.4s analyze).
  // - Slow: production with Vercel Cron every 60s, 5 jobs/tick — so
  //   5 jobs/min total throughput → ~12s effective per image after the
  //   28% keeper ratio is applied (count * 1.28 / 5 minutes).
  const fastMin = (count * 1.5) / 60;
  const slowMin = (count * 1.28) / 5;
  const fmt = (m: number) => {
    if (m < 1) return "< 1 min";
    if (m < 60) return `${Math.round(m)} min`;
    return `${Math.round((m / 60) * 10) / 10} hr`;
  };
  return `${fmt(fastMin)}–${fmt(slowMin)}`;
}
