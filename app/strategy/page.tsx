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

export const metadata = { title: "Creator Funnel Strategy — Postwise" };

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

export default function StrategyPage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">
          From discovery to <span className="title-accent">premium sale</span>
        </h1>
        <p className="hero-sub">
          Postwise applies a standard adult-creator monetization framework: clear persona ·
          layered funnel · platform-specific captions · daily three-action rhythm. Every recommendation
          you see in the analyzer is grounded in this framework.
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
          specific funnel role.
        </p>

        <TierLadder />
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

function TierLadder() {
  const tiers = [
    { n: 1, label: "Tier 1 — Lifestyle / SFW", role: "Top of funnel · social free", color: "#15803d" },
    { n: 2, label: "Tier 2 — Lingerie / implied", role: "Teaser · funnel bridge", color: "#b45309" },
    { n: 3, label: "Tier 3 — Topless / partial nude", role: "Soft paywall", color: "#d97706" },
    { n: 4, label: "Tier 4 — Fully nude", role: "Premium paywall (PPV)", color: "#c2410c" },
    { n: 5, label: "Tier 5 — Explicit / niche", role: "Top-tier paywall · customs", color: "#991b1b" },
  ];
  return (
    <div className="viz-ladder">
      {tiers.map((t) => (
        <div key={t.n} className="viz-ladder-row" style={{ borderLeftColor: t.color }}>
          <span className="viz-ladder-tag" style={{ background: t.color }}>T{t.n}</span>
          <div>
            <h4>{t.label}</h4>
            <p>{t.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
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
