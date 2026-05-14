"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
          <p className="hero-sub">Sign in first so we can save the analyses to your account.</p>
        </header>
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
          Bulk <span className="title-accent">import</span>
        </h1>
        <p className="hero-sub">
          Pick a Dropbox folder. We&rsquo;ll filter out screenshots / receipts / non-creator-content
          first (cheap pass), then deep-tag the keepers in the background. Your browser doesn&rsquo;t
          need to stay open — close it and check back later.
        </p>
        {status.account?.email && (
          <p className="hero-sub" style={{ fontSize: 13, color: "var(--muted)" }}>
            Connected as {status.account.email}
          </p>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="import-breadcrumbs">
          <button className="btn-ghost" onClick={() => setPath("")}>~ root</button>
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
                <span className="import-count-label">images here</span>
              </div>
              <div>
                <span className="import-count-num">{listing.folders.length}</span>
                <span className="import-count-label">subfolders</span>
              </div>
            </div>

            {parentPath !== null && (
              <button className="folder-row folder-row-parent" onClick={() => setPath(parentPath)}>
                <span className="folder-icon">↑</span>
                <span>.. (up one level)</span>
              </button>
            )}

            {listing.folders.length === 0 && listing.counts.images === 0 && (
              <div className="import-empty">
                <p className="import-empty-title">This folder is empty.</p>
                {(!path || path === "/") ? (
                  <>
                    <p className="import-empty-body">
                      Two common reasons your Dropbox root looks empty here:
                    </p>
                    <ol className="import-empty-list">
                      <li>
                        <strong>App-folder type Dropbox app.</strong> If you picked
                        <em> &ldquo;App folder&rdquo;</em> when creating the app at dropbox.com/developers/apps,
                        we can only see <code>Apps/&lt;your-app-name&gt;/</code> — not your whole Dropbox.
                        Either move some photos into that folder, or recreate the app with
                        <em> &ldquo;Full Dropbox&rdquo;</em> access (then disconnect + reconnect here).
                      </li>
                      <li>
                        <strong>Your photos are in a subfolder.</strong> If you keep them in
                        <code>/Photos</code> or <code>/Camera Uploads</code>, type that path below.
                      </li>
                    </ol>
                  </>
                ) : (
                  <p className="import-empty-body">
                    No images or subfolders in <code>{path}</code>. Try a different path.
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
          <p style={{ color: "var(--muted)" }}>Pick a folder to begin.</p>
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
            Time: with $5+ Replicate credit and a cron running every minute,
            this should take {humanizeDuration(forecast.count)} in the background.
            Your browser can be closed; we&rsquo;ll keep going.
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
        <span className="privacy-dot" aria-hidden /> Dropbox bytes stay in your Dropbox.
        We never duplicate them; the vault references your Dropbox files by ID and re-signs short-lived URLs server-side.
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
  // With 5 jobs/min, prefilter pass = count/5 min. Analyze pass = keepers/5 min.
  // Roughly: count * 1.28 / 5 minutes total under good rate-limit conditions.
  const minutes = (count * 1.28) / 5;
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  return `~${Math.round((minutes / 60) * 10) / 10} hours`;
}
