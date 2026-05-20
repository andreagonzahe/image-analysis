"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ResultCard, type FullResult } from "@/components/ResultCard";
import { Progress } from "@/components/Progress";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SaveButton } from "@/components/SaveButton";
import { BatchQueue } from "@/components/BatchQueue";
import { prepImage } from "@/lib/image-prep";
import Link from "next/link";

/** Build a useful filename for the downloaded image. Encodes the
 *  recommended platform + content tier so the user can sort their
 *  Downloads folder by what's going where. */
function downloadFilenameForResult(result: FullResult): string {
  const platform = result.primary_recommendation?.platform ?? "post";
  const tier = result.content_tier ?? "x";
  const date = new Date().toISOString().slice(0, 10);
  return `postwise-${platform}-T${tier}-${date}.jpg`;
}

function ValueProp() {
  return (
    <section className="valueprop">
      <h2 className="valueprop-title">Why every post matters</h2>
      <div className="valueprop-grid">
        <div className="valueprop-row valueprop-row-bad">
          <div className="valueprop-where">
            <span className="valueprop-tag valueprop-tag-bad">FREE on X</span>
            <h3>That nude photo</h3>
          </div>
          <div className="valueprop-value">$0</div>
          <p className="valueprop-note">…and it undercuts the OF sale.</p>
        </div>

        <div className="valueprop-row valueprop-row-good">
          <div className="valueprop-where">
            <span className="valueprop-tag valueprop-tag-good">PPV on OnlyFans</span>
            <h3>Same photo, sold</h3>
          </div>
          <div className="valueprop-value">$15–25</div>
          <p className="valueprop-note">…with a teaser variant funneling subs from X.</p>
        </div>
      </div>
      <p className="valueprop-bottom">
        At 4 paid-tier pieces a week, that&rsquo;s <strong>$240–$400/mo</strong> you stop leaving on
        the table. <Link href="/strategy">See the full strategy →</Link>
      </p>
    </section>
  );
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [batch, setBatch] = useState<File[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Up to 3 attempts. Auto-retry only on network errors (fetch throws TypeError
    // for fetch failed / ERR_NETWORK_CHANGED / ERR_INTERNET_DISCONNECTED).
    // API-returned errors (500 with a body) surface immediately — those need
    // a real fix, not a retry.
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: image }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Server error — surface immediately, don't loop on real failures
          setError(`${data.error || "Request failed"} (server returned ${res.status})`);
          setLoading(false);
          return;
        }
        setResult(data);
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isNetwork = /failed to fetch|networkerror|network changed|internet disconnected|load failed/i.test(msg);
        if (!isNetwork || attempt === 3) break;
        // Wait 2s then 4s before retrying
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const isNetwork = /failed to fetch|networkerror|network changed|internet disconnected|load failed/i.test(msg);
    setError(isNetwork ? "Network blip — your connection dropped mid-request. Check wifi and tap Retry." : msg);
    setLoading(false);
  };

  const reset = () => {
    setImage(null);
    setBatch(null);
    setResult(null);
    setError(null);
  };

  const onFiles = async (files: File[]) => {
    setError(null);
    if (files.length === 1) {
      setPreparing(true);
      try {
        const dataUrl = await prepImage(files[0]);
        setImage(dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPreparing(false);
      }
    } else {
      setBatch(files);
    }
  };

  if (batch) {
    return (
      <main>
        <header className="hero" style={{ marginBottom: 32 }}>
          <h1 className="title">
            Batch <span className="title-accent">analyze</span>
          </h1>
        </header>
        <BatchQueue files={batch} onReset={reset} />
      </main>
    );
  }

  return (
    <main>
      <header className="hero">
        <h1 className="title">
          Where should I <span className="title-accent">post this?</span>
        </h1>
        <p className="hero-sub">
          Posting strategy for creators monetizing on OnlyFans, Fansly, and Patreon. Every photo
          gets routed to its right rung on the content ladder — so your paid pieces stay paid,
          and your free social runs the funnel that feeds them.
        </p>
      </header>

      {!image && !preparing && (
        <>
          <Dropzone onFiles={onFiles} onError={setError} />

          <div className="dropzone-alt">
            <span className="dropzone-alt-line" />
            <span className="dropzone-alt-or">or</span>
            <span className="dropzone-alt-line" />
          </div>

          <Link href="/import" className="card dropbox-cta">
            <div className="dropbox-cta-icon" aria-hidden>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75L18 9.5 12 5.75 18 2zM0 13.25L6 9.5l6 3.75L6 17 0 13.25zm18-3.75l6 3.75L18 17l-6-3.75L18 9.5zM6 18.25l6-3.75 6 3.75L12 22l-6-3.75z"/>
              </svg>
            </div>
            <div className="dropbox-cta-text">
              <h3>Have thousands of photos already?</h3>
              <p>
                Connect your Dropbox and let Postwise filter the noise and tag the keepers in the
                background. You can close the tab while it runs.
              </p>
            </div>
            <span className="dropbox-cta-arrow">→</span>
          </Link>

          <p className="privacy-line">
            <span className="privacy-dot" aria-hidden /> Analyzed on your own Replicate account.
            Vault images live on your own Supabase project when signed in (private bucket, signed URLs).{" "}
            <a href="/how-it-works#privacy">How privacy works →</a>
          </p>
          <ValueProp />
        </>
      )}

      {preparing && (
        <div className="prep-card">
          <span className="spinner" />
          <span>Reading your image…</span>
        </div>
      )}

      {image && !result && !preparing && (
        <>
          <div className="preview">
            <div className="preview-img-wrap">
              <img src={image} alt="Preview" />
            </div>
            <div className="preview-actions">
              <p className="preview-card-title">Image ready</p>
              <p className="preview-card-body">
                Click below to analyze. We&rsquo;ll read the content, match it against twelve
                platforms&rsquo; audiences and content policies, and write captions tuned to each.
              </p>
              <button className="btn btn-primary" onClick={analyze} disabled={loading}>
                {loading ? <><span className="spinner" /> Analyzing…</> : "Recommend a platform"}
              </button>
              <button className="btn btn-secondary" onClick={reset} disabled={loading}>
                Use a different image
              </button>
            </div>
          </div>
          {loading && <Progress done={false} />}
        </>
      )}

      {error && (
        <div className="error-banner error-banner-with-actions">
          <div>{error}</div>
          {image && !loading && !result && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={analyze}>
                ↻ Retry
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                Use a different image
              </button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="result-grid">
          <div className="result-image">
            {image && <img src={image} alt="Analyzed" />}
            <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              {image && result && <SaveButton imageDataUrl={image} analysis={result} />}
              {image && (
                <a
                  href={image}
                  download={downloadFilenameForResult(result)}
                  className="btn btn-secondary"
                  style={{ width: "100%", textAlign: "center" }}
                  title="Save this image to your computer so you can post it to the recommended platform"
                >
                  ⬇ Download image
                </a>
              )}
              <button className="btn-ghost" onClick={reset} style={{ width: "100%" }}>
                Analyze another image
              </button>
            </div>
          </div>
          <ErrorBoundary>
            <ResultCard result={result} />
          </ErrorBoundary>
        </div>
      )}
    </main>
  );
}
