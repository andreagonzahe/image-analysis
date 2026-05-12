"use client";

import { useState } from "react";
import type { FullResult } from "@/components/ResultCard";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
const platformComposeUrl = (id: string) => PLATFORMS.find((p) => p.id === id)?.composeUrl;

type PlatformPlay = {
  platform: string;
  role: "post-as-is" | "shoot-teaser-variant" | "skip";
  what_to_post: string;
  caption: string;
  cadence: string;
  cta?: string;
  est_value: string;
};

type Plan = {
  weekly_revenue_estimate: { low: number; high: number; rationale: string };
  hero_platform: string;
  posting_order: string[];
  plays: PlatformPlay[];
};

export function FunnelPlan({ result }: { result: FullResult }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async () => {
    if (plan) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/funnel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: result.raw_description ?? "",
          tags: result.tags,
          content_tier: result.content_tier ?? 1,
          primary_platform: result.primary_recommendation.platform,
          primary_caption: result.primary_recommendation.caption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Funnel plan failed");
      setPlan(data.plan);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open || !plan) {
    return (
      <div className="card funnel-plan-cta">
        <div className="funnel-plan-cta-text">
          <h3>See the full week funnel for this content</h3>
          <p>
            Cross-platform plan: what to post on each platform, the caption, the cadence, and your
            weekly revenue estimate based on the tier and your profile.
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchPlan} disabled={loading}>
          {loading ? <><span className="spinner" /> Building plan…</> : "Generate funnel plan"}
        </button>
        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  return <FunnelPlanView plan={plan} />;
}

function FunnelPlanView({ plan }: { plan: Plan }) {
  return (
    <div className="card funnel-plan">
      <div className="funnel-plan-header">
        <h3>Your week, mapped</h3>
        <div className="funnel-plan-revenue">
          <span className="funnel-plan-revenue-label">Est. weekly value</span>
          <span className="funnel-plan-revenue-amount">
            ${plan.weekly_revenue_estimate.low}–${plan.weekly_revenue_estimate.high}
          </span>
        </div>
      </div>
      <p className="funnel-plan-rationale">{plan.weekly_revenue_estimate.rationale}</p>

      {plan.posting_order?.length > 0 && (
        <div className="funnel-plan-order">
          <span className="funnel-plan-order-label">Posting order:</span>
          <div className="funnel-plan-order-chain">
            {plan.posting_order.map((id, i) => (
              <span key={i} className="funnel-plan-order-item">
                {platformName(id)}
                {i < plan.posting_order.length - 1 && <span className="funnel-plan-arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="funnel-plan-plays">
        {plan.plays.map((play, i) => (
          <PlayCard key={i} play={play} isHero={play.platform === plan.hero_platform} />
        ))}
      </div>
    </div>
  );
}

function PlayCard({ play, isHero }: { play: PlatformPlay; isHero: boolean }) {
  const composeUrl = platformComposeUrl(play.platform);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(play.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const roleLabels: Record<string, string> = {
    "post-as-is": "Post this piece",
    "shoot-teaser-variant": "Shoot a teaser variant",
    "skip": "Skip — not a fit",
  };

  return (
    <article className={`play-card play-card-${play.role}${isHero ? " play-card-hero" : ""}`}>
      <div className="play-card-header">
        <h4 className="play-card-platform">
          {platformName(play.platform)}
          {isHero && <span className="hero-pill">HERO</span>}
        </h4>
        <span className="play-card-role">{roleLabels[play.role] ?? play.role}</span>
      </div>

      <p className="play-card-what">{play.what_to_post}</p>

      {play.role !== "skip" && play.caption && (
        <div className="play-card-caption">
          <span className="play-card-caption-label">Caption</span>
          <p className="caption-block">{play.caption}</p>
          {play.cta && (
            <p className="play-card-cta">
              <span className="play-card-cta-label">CTA:</span> {play.cta}
            </p>
          )}
        </div>
      )}

      <div className="play-card-footer">
        <div>
          <span className="play-card-meta-label">Cadence</span>
          <span className="play-card-meta-value">{play.cadence}</span>
        </div>
        <div>
          <span className="play-card-meta-label">Value</span>
          <span className="play-card-meta-value">{play.est_value}</span>
        </div>
      </div>

      {play.role !== "skip" && play.caption && (
        <div className="play-card-actions">
          <button className="btn-ghost" onClick={copy}>
            {copied ? "Copied ✓" : "Copy caption"}
          </button>
          {composeUrl && (
            <a className="btn-compose" href={composeUrl} target="_blank" rel="noopener noreferrer">
              Open {platformName(play.platform)} →
            </a>
          )}
        </div>
      )}
    </article>
  );
}
