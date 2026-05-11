"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ResultCard, type FullResult } from "@/components/ResultCard";
import { Progress } from "@/components/Progress";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SaveButton } from "@/components/SaveButton";
import { BatchQueue } from "@/components/BatchQueue";
import { prepImage } from "@/lib/image-prep";

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
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
          Drop one image — or many. Get the right platform, a caption in that platform&rsquo;s
          voice, suggested pricing for paid platforms, and the principles backing each call.
        </p>
      </header>

      {!image && !preparing && (
        <>
          <Dropzone onFiles={onFiles} onError={setError} />
          <p className="privacy-line">
            <span className="privacy-dot" aria-hidden /> Your images are analyzed on your own
            Replicate account — we never save them on our servers.{" "}
            <a href="/how-it-works#privacy">How privacy works →</a>
          </p>
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

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="result-grid">
          <div className="result-image">
            {image && <img src={image} alt="Analyzed" />}
            <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              {image && result && <SaveButton imageDataUrl={image} analysis={result} />}
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
