"use client";

import { useState } from "react";
import Link from "next/link";
import { PLATFORMS } from "@/lib/platforms";
import {
  FUNNEL_LAYERS,
  CONTENT_PILLARS,
  OFFER_STACK,
  CAPTION_TYPES,
  DAILY_ACTIONS,
  WEEKLY_SYSTEM,
  SPRINT_30_DAY,
  METRICS,
  ARCHETYPES,
} from "@/lib/creator-framework";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

export default function StrategyPage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">
          From discovery to <span className="title-accent">premium sale</span>
        </h1>
        <p className="hero-sub">
          Built for creators monetizing on OnlyFans, Fansly, and Patreon. This is the playbook
          Postwise applies to every photo you analyze: clear persona, layered funnel, platform-specific
          captions, daily three-action rhythm. The goal is simple — every piece earns where it&rsquo;s worth
          the most, never where it cannibalizes a paid sale.
        </p>
      </header>

      {/* ============ 1. THE 4-LAYER FUNNEL ============ */}
      <section className="legal">
        <h2>The four-layer funnel</h2>
        <p>
          Every platform plays exactly one role. Mixing roles costs money: you either give away
          something that should sell, or you push for a sale where you should be building trust.
        </p>

        <FunnelDiagram />
      </section>

      {/* ============ 2. CONTENT LADDER (TIERS) ============ */}
      <section className="legal">
        <h2>Inside the funnel: the five-tier content ladder</h2>
        <p>
          For paid creators, the content itself sits on a five-rung ladder. Each rung serves a
          specific funnel role. <em>Click any tier</em> to see what counts, what to charge, and
          where it does (and doesn&rsquo;t) belong.
        </p>

        <TierLadder />
      </section>

      {/* ============ 2b. PLATFORM-BY-PLATFORM SELECTOR ============ */}
      <section className="legal">
        <h2>Where each platform fits</h2>
        <p>
          The strategist routes every piece against this table. <em>Click a platform</em> to see
          its caption style, what it&rsquo;s best for, why it works, and how to mess it up.
        </p>

        <PlatformGrid />
      </section>

      {/* ============ 3. CONTENT PILLARS ============ */}
      <section className="legal">
        <h2>Content pillars — never just one thing</h2>
        <p>
          Pick 3–5 pillars and rotate them. A creator who posts ONLY their main fantasy burns out
          the audience. A creator who mixes 5 pillars feels three-dimensional and earns long-term
          retention.
        </p>

        <PillarsGrid />
      </section>

      {/* ============ 4. THE OFFER STACK ============ */}
      <section className="legal">
        <h2>The offer stack — what you sell, at what price</h2>
        <p>
          Don&rsquo;t put everything inside the base subscription. High-labor offers (customs,
          messaging, voice) belong as <em>capped</em> upsells — that&rsquo;s how solo creators
          break $50K/mo without burning out.
        </p>

        <OfferStackTower />
      </section>

      {/* ============ 5. CAPTION TYPES ============ */}
      <section className="legal">
        <h2>Captions do one of four jobs</h2>
        <p>
          The strategist tags every caption it generates with one of these. Mix the four across a
          week — never four conversion posts in a row, never four retention posts to people who
          haven&rsquo;t converted yet.
        </p>

        <CaptionMatrix />
      </section>

      {/* ============ 6. THE DAILY 3-ACTION RULE ============ */}
      <section className="legal">
        <h2>The daily 3-action rule</h2>
        <p>
          Every day, regardless of how busy: one discovery action, one conversion action, one
          retention action. This stops you from getting addicted to one type and starving the
          others.
        </p>

        <DailyActionsTriangle />
      </section>

      {/* ============ 7. WEEKLY CADENCE ============ */}
      <section className="legal">
        <h2>Weekly operating system</h2>
        <p>
          Solo creators who batch their work consistently outearn those who post reactively. Here&rsquo;s
          the typical week shape.
        </p>

        <WeeklyCalendar />
      </section>

      {/* ============ 8. 30-DAY SPRINT ============ */}
      <section className="legal">
        <h2>The 30-day sprint</h2>
        <p>
          If you&rsquo;re starting fresh — or restarting after burnout — here&rsquo;s the 4-week
          arc. Don&rsquo;t skip week 1.
        </p>

        <SprintTimeline />
      </section>

      {/* ============ 9. PERSONA ARCHETYPES ============ */}
      <section className="legal">
        <h2>Persona archetypes</h2>
        <p>
          The strongest brands are specific enough to be memorable but broad enough to produce
          content consistently. Pick ONE archetype and stay in it across all platforms — fragmented
          identity kills conversion.
        </p>

        <ArchetypeGrid />
      </section>

      {/* ============ 10. METRICS ============ */}
      <section className="legal">
        <h2>What to measure</h2>
        <p>
          The metrics worth your time. Most creators obsess over follower counts (vanity) and ignore
          revenue per paying fan (the actual KPI).
        </p>

        <MetricsDashboard />
      </section>

      {/* ============ 11. HARD RULES ============ */}
      <section className="legal">
        <h2>Hard rules Postwise enforces automatically</h2>
        <ul>
          <li><strong>Never post Tier 3+ for free on social.</strong> The analyzer&rsquo;s enforcer rejects this mechanically.</li>
          <li><strong>Always shoot a teaser variant for paid content.</strong> Tier 4 PPV needs a Tier 2 sister for the funnel to work.</li>
          <li><strong>Match price to (tier × production × niche).</strong> Phone-selfie pricing ≠ studio-shoot pricing.</li>
          <li><strong>Match the platform voice on every caption.</strong> A Reddit title isn&rsquo;t an Instagram caption isn&rsquo;t an OF DM.</li>
          <li><strong>Cap premium intimacy.</strong> If GFE messaging is unlimited, you give yourself a $50K ceiling on burnout. Cap it; charge accordingly.</li>
        </ul>
      </section>

      <div className="cta-row" style={{ justifyContent: "center", marginTop: 36 }}>
        <Link href="/" className="btn btn-primary">Analyze content</Link>
        <Link href="/how-it-works" className="btn btn-secondary">How it works</Link>
      </div>
    </main>
  );
}

/* ============ VISUAL COMPONENTS ============ */

function FunnelDiagram() {
  return (
    <div className="viz-funnel">
      {FUNNEL_LAYERS.map((layer, i) => (
        <div key={layer.id} className={`viz-funnel-layer viz-funnel-layer-${i}`}>
          <div className="viz-funnel-row">
            <span className="viz-funnel-num">{i + 1}</span>
            <div className="viz-funnel-meat">
              <h3 className="viz-funnel-title">{layer.label}</h3>
              <p className="viz-funnel-job">{layer.job}</p>
              <div className="viz-funnel-platforms">
                {layer.platforms.map((id) => (
                  <span key={id} className="viz-chip">{platformName(id)}</span>
                ))}
              </div>
            </div>
          </div>
          {i < FUNNEL_LAYERS.length - 1 && (
            <div className="viz-funnel-arrow" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type TierDetail = {
  n: 1 | 2 | 3 | 4 | 5;
  label: string;
  role: string;
  color: string;
  bodyParts: string;
  price: string;
  goes: string[]; // platform ids where this tier belongs
  avoid: string[]; // platform ids that would BURN this tier
  captionTone: string;
};

const TIERS: TierDetail[] = [
  {
    n: 1,
    label: "Tier 1 — Lifestyle / SFW",
    role: "Top-of-funnel discovery. The hook.",
    color: "#15803d",
    bodyParts: "Face / shoulders / fully clothed. No skin focus.",
    price: "Free — these never get a price tag. They're how new people find you.",
    goes: ["instagram", "tiktok", "x", "bluesky", "pinterest", "linkedin"],
    avoid: [],
    captionTone:
      "Warm, observational, lifestyle-y. Personality first. Hashtags where the platform expects them (IG, Pinterest).",
  },
  {
    n: 2,
    label: "Tier 2 — Lingerie / implied / suggestive",
    role: "Funnel bridge. Teases the paid stuff.",
    color: "#b45309",
    bodyParts: "Cleavage · thighs · midriff visible. Lingerie / swimwear / underwear as primary garment.",
    price: "Tip-unlock $3-10 on OF/Fansly, OR free loyalty content on the paid wall, OR Premium Snap monthly $10-15.",
    goes: ["x-nsfw", "reddit-nsfw", "snapchat", "snapchat-premium", "onlyfans_free", "onlyfans_wall", "fansly", "patreon"],
    avoid: [],
    captionTone:
      "Tease + funnel CTA. 'More on my OF 🔥 link in bio'. Spicy without crude. Build curiosity, not desperation.",
  },
  {
    n: 3,
    label: "Tier 3 — Topless / partial nude (artistic)",
    role: "Soft paywall. Wall content for paid subs.",
    color: "#d97706",
    bodyParts:
      "Breasts visible (no genitals) OR buttocks visible. Tasteful framing — sensual_aesthetic or erotic_intentional, not explicit.",
    price: "PPV $8-22 depending on framing, OR tier-locked $10-15/mo on the paid wall.",
    goes: ["onlyfans_wall", "onlyfans_ppv", "fansly", "patreon", "snapchat-premium"],
    avoid: ["instagram", "tiktok", "x", "bluesky", "linkedin", "pinterest", "reddit-sfw", "onlyfans_free"],
    captionTone:
      "Confident, intimate, NOT crude. Tease around what's visible — 'you've been thinking about this'. Don't name body parts directly.",
  },
  {
    n: 4,
    label: "Tier 4 — Fully nude (explicit pose)",
    role: "Premium paywall — PPV unlock territory.",
    color: "#c2410c",
    bodyParts: "Genitals OR full nudity visible. Modeling_seductive or explicit framing.",
    price: "PPV $12-30 baseline. +20-40% if genitals visible. +30-50% if professional production.",
    goes: ["onlyfans_ppv", "fansly"],
    avoid: ["instagram", "tiktok", "x", "bluesky", "linkedin", "pinterest", "reddit-sfw", "snapchat", "patreon", "onlyfans_free", "onlyfans_wall"],
    captionTone:
      "In PPV DMs the language gets direct. Wall caption (if doing teaser+PPV) stays implicit — let the DM do the explicit work.",
  },
  {
    n: 5,
    label: "Tier 5 — Explicit acts / niche kink",
    role: "Top of the paywall — customs + premium PPV.",
    color: "#991b1b",
    bodyParts: "Explicit sexual acts OR niche fetish content.",
    price: "PPV $20-100+ depending on solo / partnered / group / kink niche.",
    goes: ["onlyfans_ppv", "fansly"],
    avoid: [
      "instagram",
      "tiktok",
      "x",
      "x-nsfw",
      "bluesky",
      "linkedin",
      "pinterest",
      "reddit-sfw",
      "reddit-nsfw",
      "snapchat",
      "snapchat-premium",
      "patreon",
      "onlyfans_free",
      "onlyfans_wall",
    ],
    captionTone:
      "DM-style sell message paired with the unlock. Customs offer: 'made something just for you...'. Never on a wall.",
  },
];

function TierLadder() {
  const [openTier, setOpenTier] = useState<number | null>(null);
  return (
    <div className="viz-ladder">
      {TIERS.map((t) => {
        const isOpen = openTier === t.n;
        return (
          <div
            key={t.n}
            className={`viz-ladder-row viz-ladder-row-clickable${isOpen ? " viz-ladder-row-open" : ""}`}
            style={{ borderLeftColor: t.color }}
            onClick={() => setOpenTier(isOpen ? null : t.n)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenTier(isOpen ? null : t.n);
              }
            }}
          >
            <div className="viz-ladder-head">
              <span className="viz-ladder-tag" style={{ background: t.color }}>T{t.n}</span>
              <div className="viz-ladder-text">
                <h4>{t.label}</h4>
                <p>{t.role}</p>
              </div>
              <span className="viz-ladder-toggle" aria-hidden>{isOpen ? "−" : "+"}</span>
            </div>
            {isOpen && (
              <div className="viz-ladder-detail">
                <DetailRow label="What's visible">{t.bodyParts}</DetailRow>
                <DetailRow label="Price">{t.price}</DetailRow>
                <DetailRow label="Where it belongs">
                  <div className="viz-platform-chips">
                    {t.goes.map((id) => (
                      <span key={id} className="viz-chip viz-chip-go">{platformName(id)}</span>
                    ))}
                  </div>
                </DetailRow>
                {t.avoid.length > 0 && (
                  <DetailRow label="NEVER here">
                    <div className="viz-platform-chips">
                      {t.avoid.map((id) => (
                        <span key={id} className="viz-chip viz-chip-avoid">{platformName(id)}</span>
                      ))}
                    </div>
                  </DetailRow>
                )}
                <DetailRow label="Caption tone">{t.captionTone}</DetailRow>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="viz-detail-row">
      <span className="viz-detail-label">{label}</span>
      <div className="viz-detail-body">{children}</div>
    </div>
  );
}

function PlatformGrid() {
  const [selected, setSelected] = useState<string>("instagram");
  const platform = PLATFORMS.find((p) => p.id === selected) ?? PLATFORMS[0];

  // Group platforms by funnel role for cleaner navigation.
  const groups = [
    {
      label: "Free social (top of funnel)",
      ids: ["instagram", "tiktok", "x", "bluesky", "linkedin", "pinterest", "reddit-sfw"],
    },
    {
      label: "Adult social (teaser bridge)",
      ids: ["x-nsfw", "reddit-nsfw", "snapchat"],
    },
    {
      label: "OnlyFans (3 destinations)",
      ids: ["onlyfans_free", "onlyfans_wall", "onlyfans_ppv"],
    },
    {
      label: "Other paid",
      ids: ["fansly", "snapchat-premium", "patreon"],
    },
  ];

  return (
    <div className="viz-platforms">
      <div className="viz-platforms-nav">
        {groups.map((g) => (
          <div key={g.label} className="viz-platforms-nav-group">
            <p className="viz-platforms-nav-label">{g.label}</p>
            <div className="viz-platforms-nav-chips">
              {g.ids.map((id) => {
                const p = PLATFORMS.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`viz-platforms-chip${selected === id ? " viz-platforms-chip-active" : ""}${p.paid ? " viz-platforms-chip-paid" : ""}`}
                    onClick={() => setSelected(id)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <article className="viz-platforms-detail">
        <header className="viz-platforms-detail-head">
          <h3>
            {platform.name}
            <span
              className={`viz-platforms-policy viz-platforms-policy-${platform.policy.replace(/-/g, "_")}`}
            >
              {policyLabel(platform.policy)}
            </span>
            {platform.paid && <span className="viz-platforms-paid-tag">Paid platform</span>}
          </h3>
        </header>

        <DetailRow label="Audience">{platform.audience}</DetailRow>
        <DetailRow label="Best for">{platform.bestFor}</DetailRow>
        <DetailRow label="Caption style">{platform.captionStyle}</DetailRow>
        <DetailRow label="Hashtags">{platform.hashtagNorm}</DetailRow>
        <DetailRow label="Why it works">{platform.whyItWorks}</DetailRow>
        <DetailRow label="Why to avoid (when it doesn't fit)">{platform.whyToAvoid}</DetailRow>

        {platform.wisdom.length > 0 && (
          <DetailRow label="Creator wisdom we cite">
            <ul className="viz-platforms-wisdom">
              {platform.wisdom.map((w) => (
                <li key={w.id}>
                  <strong>&ldquo;{w.principle}&rdquo;</strong>
                  <span className="viz-platforms-wisdom-attr"> — {w.attribution}</span>
                </li>
              ))}
            </ul>
          </DetailRow>
        )}
      </article>
    </div>
  );
}

function policyLabel(policy: string): string {
  if (policy === "no-nudity") return "No nudity";
  if (policy === "suggestive-ok") return "Suggestive OK";
  if (policy === "explicit-ok") return "Explicit OK";
  return policy;
}

function PillarsGrid() {
  return (
    <div className="viz-pillars">
      {CONTENT_PILLARS.map((p, i) => (
        <article key={p.id} className="viz-pillar-card" style={{ ["--pillar-index" as string]: i }}>
          <span className="viz-pillar-num">{i + 1}</span>
          <h4>{p.label}</h4>
          <p className="viz-pillar-desc">{p.description}</p>
          <ul className="viz-pillar-examples">
            {p.example_posts.map((ex, j) => <li key={j}>{ex}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function OfferStackTower() {
  return (
    <div className="viz-tower">
      {OFFER_STACK.slice().reverse().map((t, i) => (
        <div key={t.id} className="viz-tower-row" data-rank={OFFER_STACK.length - i}>
          <span className="viz-tower-rank">{OFFER_STACK.length - i}</span>
          <div className="viz-tower-meat">
            <h4>{t.label}</h4>
            <p className="viz-tower-aud">{t.audience}</p>
          </div>
          <span className="viz-tower-price">{t.pricing}</span>
        </div>
      ))}
    </div>
  );
}

function CaptionMatrix() {
  return (
    <div className="viz-caption-matrix">
      {CAPTION_TYPES.map((c, i) => (
        <article key={c.id} className={`viz-caption-cell viz-caption-${c.id}`} data-i={i}>
          <span className="viz-caption-tag">{c.label}</span>
          <p className="viz-caption-job">{c.job}</p>
          <p className="viz-caption-example">{c.example}</p>
        </article>
      ))}
    </div>
  );
}

function DailyActionsTriangle() {
  return (
    <div className="viz-daily">
      {DAILY_ACTIONS.map((a, i) => (
        <article key={a.id} className={`viz-daily-card viz-daily-${a.id}`} data-i={i}>
          <span className="viz-daily-num">{i + 1}</span>
          <h4>{a.label}</h4>
          <p>{a.example}</p>
        </article>
      ))}
    </div>
  );
}

function WeeklyCalendar() {
  return (
    <div className="viz-week">
      {WEEKLY_SYSTEM.map((d, i) => (
        <article key={d.day} className="viz-day-card" data-i={i}>
          <span className="viz-day-name">{d.day}</span>
          <p className="viz-day-job">{d.job}</p>
        </article>
      ))}
    </div>
  );
}

function SprintTimeline() {
  return (
    <div className="viz-sprint">
      <div className="viz-sprint-track" aria-hidden />
      {SPRINT_30_DAY.map((w) => (
        <article key={w.week} className="viz-sprint-week">
          <div className="viz-sprint-marker">
            <span className="viz-sprint-week-num">W{w.week}</span>
          </div>
          <h4 className="viz-sprint-label">{w.label}</h4>
          <ul className="viz-sprint-goals">
            {w.goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function ArchetypeGrid() {
  return (
    <div className="viz-archetypes">
      {ARCHETYPES.map((a) => (
        <article key={a.id} className="viz-archetype">
          <h4>{a.label}</h4>
          <p className="viz-archetype-promise">{a.emotional_promise}</p>
          <div className="viz-archetype-tones">
            {a.tone_fits.map((t) => <span key={t} className="viz-chip-sm">{t}</span>)}
          </div>
        </article>
      ))}
    </div>
  );
}

function MetricsDashboard() {
  return (
    <div className="viz-metrics">
      {METRICS.map((m) => (
        <article key={m.id} className="viz-metrics-cat">
          <h4>{m.label}</h4>
          <ul>
            {m.metrics.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}
