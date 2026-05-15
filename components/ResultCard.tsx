"use client";

import { useState } from "react";
import type {
  AnalysisResult,
  WisdomCitation,
  PricingSuggestion,
  PostType,
  Recommendation,
  FunnelStrategy,
} from "@/lib/prompt";
import type { ImageTags } from "@/lib/captioner";
import { PLATFORMS } from "@/lib/platforms";
import { FunnelPlan } from "@/components/FunnelPlan";

export type FullResult = AnalysisResult & {
  raw_description?: string;
  nsfw_verdict?: "nsfw" | "normal";
  tags?: ImageTags;
};

const platform = (id: string) => PLATFORMS.find((p) => p.id === id);
const platformName = (id: string) => platform(id)?.name ?? id;

function CaptionBlock({
  caption,
  hashtags,
  onRewrite,
  rewriting,
  composeUrl,
}: {
  caption: string;
  hashtags: string[];
  onRewrite?: () => void;
  rewriting?: boolean;
  composeUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const fullText = hashtags?.length ? `${caption}\n\n${hashtags.join(" ")}` : caption;
  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const copyAndOpen = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    if (composeUrl) window.open(composeUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <p className="caption-block">{caption}</p>
      {hashtags?.length > 0 && (
        <ul className="hashtags">
          {hashtags.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
      <div className="caption-actions">
        <button className="btn-ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy caption"}
        </button>
        {onRewrite && (
          <button className="btn-ghost" onClick={onRewrite} disabled={rewriting}>
            {rewriting ? <><span className="spinner" /> Rewriting…</> : "Rewrite with AI"}
          </button>
        )}
        {composeUrl && (
          <button className="btn-compose" onClick={copyAndOpen}>
            Open {platformName(composeUrl.includes("instagram") ? "instagram" : "")} →
          </button>
        )}
      </div>
    </>
  );
}

function PostToButton({ platformId }: { platformId: string }) {
  const p = platform(platformId);
  if (!p) return null;
  return (
    <a
      className="btn-compose"
      href={p.composeUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open {p.name} →
    </a>
  );
}

function FunnelStrategyBlock({
  strategy,
  rawDescription,
  tags,
  nsfwVerdict,
  onRetier,
}: {
  strategy: FunnelStrategy;
  rawDescription?: string;
  tags?: ImageTags;
  nsfwVerdict?: "nsfw" | "normal";
  onRetier?: (newResult: FullResult) => void;
}) {
  const [retiering, setRetiering] = useState(false);
  const [openOverride, setOpenOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!strategy) return null;
  const tierLabels: Record<number, string> = {
    1: "Tier 1 — Lifestyle / SFW",
    2: "Tier 2 — Lingerie / implied",
    3: "Tier 3 — Topless / partial nude",
    4: "Tier 4 — Fully nude",
    5: "Tier 5 — Explicit / niche",
  };
  const roleLabels: Record<string, string> = {
    "top-of-funnel-teaser": "Top-of-funnel teaser",
    "loyalty-content": "Loyalty content",
    "soft-paywall": "Soft paywall",
    "premium-paywall": "Premium paywall",
    "exclusive-top-tier": "Exclusive top-tier",
  };

  const canRetier = Boolean(rawDescription && tags && nsfwVerdict && onRetier);

  async function retier(forced_tier: number) {
    if (!rawDescription || !tags || !nsfwVerdict || !onRetier) return;
    setRetiering(true);
    setError(null);
    try {
      const res = await fetch("/api/retier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: rawDescription,
          tags,
          nsfw_verdict: nsfwVerdict,
          forced_tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-tier failed");
      onRetier(data);
      setOpenOverride(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetiering(false);
    }
  }

  return (
    <div className="funnel">
      <div className="funnel-header">
        <span className="funnel-tier-pill" data-tier={strategy.this_image_tier}>
          {tierLabels[strategy.this_image_tier] ?? `Tier ${strategy.this_image_tier}`}
        </span>
        <span className="funnel-role">{roleLabels[strategy.this_image_role] ?? strategy.this_image_role}</span>
        {canRetier && (
          <button
            type="button"
            className="funnel-retier-btn"
            onClick={() => setOpenOverride((v) => !v)}
            disabled={retiering}
          >
            {retiering ? "Re-routing…" : openOverride ? "Cancel" : "Wrong tier?"}
          </button>
        )}
      </div>
      {openOverride && (
        <div className="funnel-override">
          <span className="funnel-override-label">Force tier:</span>
          {([1, 2, 3, 4, 5] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`tier-btn tier-btn-${t}`}
              onClick={() => retier(t)}
              disabled={retiering || t === strategy.this_image_tier}
            >
              T{t}
            </button>
          ))}
        </div>
      )}
      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
      <p className="funnel-path">{strategy.monetization_path}</p>
      {strategy.teaser_variant_needed && (
        <div className="funnel-teaser">
          <span className="funnel-teaser-label">For social funnel, shoot a teaser variant:</span>
          <p className="funnel-teaser-text">{strategy.teaser_variant_needed}</p>
        </div>
      )}
      <a href="/strategy" target="_blank" rel="noreferrer" className="funnel-learn-more">
        Learn more about the funnel strategy →
      </a>
    </div>
  );
}

function TagRow({ label, value, wide }: { label: string; value: string | undefined | null; wide?: boolean }) {
  const display = String(value ?? "unknown").replace(/_/g, " ");
  return (
    <div className={`tag-row${wide ? " tag-row-wide" : ""}`}>
      <span className="tag-row-label">{label}</span>
      <span className="tag-row-value">{display}</span>
    </div>
  );
}

function PostTypeBadge({ postType }: { postType: PostType }) {
  if (!postType?.label) return null;
  return (
    <div className="post-type">
      <div className="post-type-header">
        <span className="post-type-label">{postType.label.replace(/_/g, " ")}</span>
      </div>
      {postType.description && <p className="post-type-desc">{postType.description}</p>}
    </div>
  );
}

function DistributionBadge({
  mode,
  rationale,
}: {
  mode: "wall" | "ppv" | "both";
  rationale: string | null;
}) {
  const labels: Record<typeof mode, string> = {
    wall: "Wall (paid feed only)",
    ppv: "PPV in DMs only",
    both: "Wall teaser + PPV DM",
  };
  const sub: Record<typeof mode, string> = {
    wall: "Post to your subscribers' feed. No DM unlock — they get it as part of the sub.",
    ppv: "Don't put this on the wall. Mass-DM it as a paid unlock.",
    both: "Wall post (teaser/SFW-er pick from this look) + a separate PPV DM with the full version.",
  };
  return (
    <div className="distribution-badge" data-mode={mode}>
      <div className="distribution-header">
        <span className="distribution-label">Distribution</span>
        <span className="distribution-mode">{labels[mode]}</span>
      </div>
      <p className="distribution-sub">{sub[mode]}</p>
      {rationale && <p className="distribution-rationale">{rationale}</p>}
    </div>
  );
}

function PpvDmMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="ppv-dm">
      <div className="ppv-dm-header">
        <span className="ppv-dm-label">DM message (send with PPV unlock)</span>
        <button className="btn-ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="ppv-dm-text">{message}</p>
    </div>
  );
}

function PriceTag({ pricing }: { pricing: PricingSuggestion }) {
  const suggested = typeof pricing.suggested_price === "number" ? pricing.suggested_price : null;
  const showBand = suggested !== null && (pricing.low_usd !== suggested || pricing.high_usd !== suggested);
  const isFree = (suggested ?? pricing.low_usd) === 0 && pricing.high_usd === 0;

  return (
    <div className="pricing">
      <div className="pricing-header">
        <span className="pricing-label">Start with</span>
        <span className="pricing-range">
          {isFree
            ? "Free for subscribers"
            : suggested !== null
              ? `$${suggested}`
              : pricing.low_usd === pricing.high_usd
                ? `$${pricing.low_usd}`
                : `$${pricing.low_usd}–$${pricing.high_usd}`}
        </span>
      </div>
      <div className="pricing-model">{pricing.model}</div>
      {showBand && !isFree && (
        <div className="pricing-band">
          Reasonable band: ${pricing.low_usd}–${pricing.high_usd}
        </div>
      )}
      <p className="pricing-rationale">{pricing.rationale}</p>
      {pricing.escalation && (
        <div className="pricing-row">
          <span className="pricing-row-label">If it doesn&rsquo;t unlock:</span>
          <span className="pricing-row-value">{pricing.escalation}</span>
        </div>
      )}
      {pricing.best_send_time && (
        <div className="pricing-row">
          <span className="pricing-row-label">Best send time:</span>
          <span className="pricing-row-value">{pricing.best_send_time}</span>
        </div>
      )}
      {pricing.bundle_alternative && (
        <div className="pricing-row pricing-row-alt">
          <span className="pricing-row-label">Bundle alternative:</span>
          <span className="pricing-row-value">{pricing.bundle_alternative}</span>
        </div>
      )}
    </div>
  );
}

function StrategyBlock({ text }: { text: string }) {
  return (
    <div className="strategy">
      <span className="strategy-label">Strategy fit</span>
      <p className="strategy-text">{text}</p>
    </div>
  );
}

function WisdomQuote({ wisdom }: { wisdom: WisdomCitation }) {
  if (!wisdom || !wisdom.principle) return null;
  return (
    <div className="wisdom">
      <p className="wisdom-principle">&ldquo;{wisdom.principle}&rdquo;</p>
      {wisdom.attribution && <p className="wisdom-attribution">— {wisdom.attribution}</p>}
      {wisdom.context && <p className="wisdom-context">{wisdom.context}</p>}
    </div>
  );
}

function RecBody({
  rec,
  description,
  tags,
  onCaptionUpdate,
}: {
  rec: Recommendation;
  description: string;
  tags: ImageTags | undefined;
  onCaptionUpdate: (newCaption: string) => void;
}) {
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rewrite = async () => {
    if (!tags) return;
    setRewriting(true);
    setError(null);
    try {
      const res = await fetch("/api/rewrite-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: rec.platform,
          description,
          tags,
          current_caption: rec.caption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rewrite failed");
      onCaptionUpdate(data.caption);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRewriting(false);
    }
  };

  return (
    <>
      <p className="reason">{rec.reason}</p>

      {rec.post_type && <PostTypeBadge postType={rec.post_type} />}
      {rec.distribution_mode && (
        <DistributionBadge mode={rec.distribution_mode} rationale={rec.distribution_rationale ?? null} />
      )}
      {rec.pricing_suggestion && <PriceTag pricing={rec.pricing_suggestion} />}
      {rec.ppv_dm_message && <PpvDmMessage message={rec.ppv_dm_message} />}
      {rec.strategy_alignment && <StrategyBlock text={rec.strategy_alignment} />}
      {rec.wisdom && <WisdomQuote wisdom={rec.wisdom} />}

      <p className="section-label">Caption</p>
      <CaptionBlock
        caption={rec.caption}
        hashtags={rec.hashtags ?? []}
        onRewrite={rewrite}
        rewriting={rewriting}
      />
      <div className="rec-footer">
        <PostToButton platformId={rec.platform} />
      </div>
      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
    </>
  );
}

export function ResultCard({ result: initialResult }: { result: FullResult }) {
  const [showFull, setShowFull] = useState(false);
  const [result, setResult] = useState<FullResult>(initialResult);
  const [primary, setPrimary] = useState(initialResult.primary_recommendation);
  const [alternatives, setAlternatives] = useState(initialResult.alternatives);

  const handleRetier = (newResult: FullResult) => {
    setResult(newResult);
    setPrimary(newResult.primary_recommendation);
    setAlternatives(newResult.alternatives);
  };

  const updatePrimaryCaption = (newCaption: string) => {
    setPrimary((p) => ({ ...p, caption: newCaption }));
  };
  const updateAltCaption = (i: number) => (newCaption: string) => {
    setAlternatives((alts) =>
      alts.map((a, idx) => (idx === i ? { ...a, caption: newCaption } : a))
    );
  };

  return (
    <div className="result">
      {result.funnel_strategy && (
        <FunnelStrategyBlock
          strategy={result.funnel_strategy}
          rawDescription={result.raw_description}
          tags={result.tags}
          nsfwVerdict={result.nsfw_verdict}
          onRetier={handleRetier}
        />
      )}

      <div className="card card-primary">
        <div className="card-header">
          <h2 className="platform-name">
            <span className="post-to">Post to</span>
            {platformName(primary.platform)}
          </h2>
          <span className={`rating-pill ${result.content_rating}`}>{result.content_rating}</span>
        </div>

        <RecBody
          rec={primary}
          description={result.raw_description ?? ""}
          tags={result.tags}
          onCaptionUpdate={updatePrimaryCaption}
        />

        <div className="disclosure">
          <button className="btn-ghost" onClick={() => setShowFull((v) => !v)}>
            {showFull ? "Hide what the AI detected" : "What the AI detected in your image"}
          </button>
          {showFull && (
            <>
              {result.tags && (
                <div className="tag-grid">
                  <TagRow label="Attire" value={result.tags.attire} />
                  <TagRow label="Sensuality" value={result.tags.sensuality} />
                  <TagRow label="Pose intent" value={result.tags.pose_intent} />
                  <TagRow label="People in frame" value={String(result.tags.people_in_frame)} />
                  <TagRow label="Scene" value={result.tags.scene} />
                  <TagRow label="Production" value={result.tags.production_quality} />
                  <TagRow
                    label="Body parts visible"
                    value={
                      Array.isArray(result.tags.body_parts_visible) && result.tags.body_parts_visible.length
                        ? result.tags.body_parts_visible.join(", ")
                        : "none reported"
                    }
                    wide
                  />
                </div>
              )}
              <p style={{ marginTop: 14, marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
                Summary: {result.image_summary}
              </p>
              {result.raw_description && (
                <div className="disclosure-panel">{result.raw_description}</div>
              )}
            </>
          )}
        </div>
      </div>

      {alternatives?.length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginTop: 0 }}>
            Also works on
          </p>
          {alternatives.map((alt, i) => (
            <div key={i} className="alt-block">
              <h3 className="alt-platform">{platformName(alt.platform)}</h3>
              <RecBody
                rec={alt}
                description={result.raw_description ?? ""}
                tags={result.tags}
                onCaptionUpdate={updateAltCaption(i)}
              />
            </div>
          ))}
        </div>
      )}

      <FunnelPlan result={result} />

      {result.do_not_post?.length > 0 && (
        <div className="card">
          <p className="section-label" style={{ marginTop: 0 }}>
            Don&rsquo;t post on
          </p>
          <div className="do-not-list">
            {result.do_not_post.map((entry, i) => {
              const item = typeof entry === "string" ? { platform: entry, reason: "" } : entry;
              return (
                <div key={i} className="do-not-item">
                  <div className="do-not-platform">{platformName(item.platform)}</div>
                  <p className="do-not-reason">{item.reason || "Content doesn't fit this platform."}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
