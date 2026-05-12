import Link from "next/link";

export const metadata = { title: "Creator Funnel Strategy — Postwise" };

export default function StrategyPage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">
          From discoverability to <span className="title-accent">sale</span>
        </h1>
        <p className="hero-sub">
          The reason Postwise asks for content tiers isn&rsquo;t to be clinical — it&rsquo;s because
          a working creator economy runs on a funnel. Free traffic finds you. Paid subscribers stick
          with you. Each post has a different job. Mixing them up is what costs money.
        </p>
      </header>

      <section className="legal">
        <h2>The five-tier content ladder</h2>
        <p>
          Every piece of content you make sits on a ladder of intensity. The ladder isn&rsquo;t
          moral — it&rsquo;s economic. Each rung serves a different funnel role, and the wrong rung
          on the wrong platform either wastes the asset or hurts the account.
        </p>

        <div className="tier-cards">
          <article className="tier-card" data-tier="1">
            <div className="tier-card-header">
              <span className="tier-pill" data-tier="1">Tier 1</span>
              <h3>Lifestyle / SFW</h3>
            </div>
            <p>Fully clothed. Headshots, OOTD, behind-the-scenes, coffee-and-laptop content.</p>
            <p className="tier-card-role">
              <strong>Job:</strong> top of the funnel. Maximum reach. Builds your discoverable
              brand on Instagram, TikTok, Pinterest, Bluesky, LinkedIn, X.
            </p>
            <p className="tier-card-action">
              <strong>Money path:</strong> drives followers and brand deals; almost never sold
              directly.
            </p>
          </article>

          <article className="tier-card" data-tier="2">
            <div className="tier-card-header">
              <span className="tier-pill" data-tier="2">Tier 2</span>
              <h3>Lingerie / Implied / Suggestive</h3>
            </div>
            <p>Swimwear, lingerie modeled tastefully, implied nudes, sensual aesthetic. Skin shown, nothing explicit.</p>
            <p className="tier-card-role">
              <strong>Job:</strong> the teaser. This is the funnel bridge: posts on X / Bluesky /
              Instagram (carefully) with a clear CTA (&ldquo;full set on OF&rdquo;) drive subs from
              free social to your paid platform.
            </p>
            <p className="tier-card-action">
              <strong>Money path:</strong> free on social (with funnel CTA); OR tip-unlock $3–10 on
              OnlyFans / Fansly as loyalty content for existing subs.
            </p>
          </article>

          <article className="tier-card" data-tier="3">
            <div className="tier-card-header">
              <span className="tier-pill" data-tier="3">Tier 3</span>
              <h3>Topless / Partial Nude (Artistic)</h3>
            </div>
            <p>Breasts uncovered, partial nudity, boudoir aesthetic. Visible skin past Tier 2 but no explicit framing.</p>
            <p className="tier-card-role">
              <strong>Job:</strong> the first paywall. This rung crosses from free into paid — never
              post a Tier 3 piece for free, you&rsquo;d undercut the sale.
            </p>
            <p className="tier-card-action">
              <strong>Money path:</strong> tip-unlock $5–12 OR PPV $8–18 on OnlyFans / Fansly.
              Premium Snapchat tier-locked at $10–15/mo.
            </p>
          </article>

          <article className="tier-card" data-tier="4">
            <div className="tier-card-header">
              <span className="tier-pill" data-tier="4">Tier 4</span>
              <h3>Fully Nude / Explicit Pose</h3>
            </div>
            <p>Full nudity, erotically framed but no acts. The bulk of paid creator income lives here.</p>
            <p className="tier-card-role">
              <strong>Job:</strong> premium paywall — the daily-driver PPV that subs actively pay
              for. This is where pricing strategy matters most.
            </p>
            <p className="tier-card-action">
              <strong>Money path:</strong> PPV unlock $12–30 on OnlyFans / Fansly. Multipliers for
              professional production (+30–50%) and taboo settings (+20–40%).
            </p>
          </article>

          <article className="tier-card" data-tier="5">
            <div className="tier-card-header">
              <span className="tier-pill" data-tier="5">Tier 5</span>
              <h3>Explicit Acts / Niche Kink</h3>
            </div>
            <p>Sex acts in frame, partnered content, specific kink material.</p>
            <p className="tier-card-role">
              <strong>Job:</strong> top-tier paywall — the premium-priced pieces and custom
              commissions. Higher production cost; commands premium pricing.
            </p>
            <p className="tier-card-action">
              <strong>Money path:</strong> PPV $20–60 (solo) / $30–100+ (partnered or premium) on
              OnlyFans / Fansly. Fansly often preferred for specific kinks OF has restricted.
            </p>
          </article>
        </div>
      </section>

      <section className="legal">
        <h2>How the funnel connects</h2>
        <p>
          A working creator economy isn&rsquo;t &ldquo;post the same thing everywhere.&rdquo;
          It&rsquo;s a layered funnel:
        </p>

        <ol className="funnel-steps">
          <li>
            <strong>Tier 1 on Instagram / TikTok / Pinterest / Bluesky</strong> earns you visibility
            with the broadest possible audience. Every follower here is a future maybe-customer.
            Caption: warm, on-brand, no CTA needed.
          </li>
          <li>
            <strong>Tier 2 on X / Bluesky / Instagram (carefully)</strong> turns warm followers into
            qualified leads. The post is lingerie or implied — the caption ends with a clear CTA
            pointing to your paid platform (&ldquo;full set on OF 🔥 link in bio&rdquo;).
          </li>
          <li>
            <strong>Tier 2–3 on Reddit NSFW subs</strong> is the same funnel mechanic at scale.
            Verified accounts on the right niche sub can drive thousands of paid subs per month.
            The Reddit post is the teaser; the OF profile is the destination.
          </li>
          <li>
            <strong>Tier 3 (soft paywall) on OnlyFans / Fansly</strong> retains subs after they
            convert. Free-for-subscribers or tip-unlock posts build parasocial bond without
            churning them.
          </li>
          <li>
            <strong>Tier 4 PPV on OnlyFans / Fansly</strong> is the main revenue line. This is the
            content the funnel has been building toward — premium pieces sold individually.
          </li>
          <li>
            <strong>Tier 5 custom / premium</strong> is where individual subs become high-LTV
            customers via custom requests, exclusive content, or one-on-one offers.
          </li>
        </ol>

        <p>
          Postwise routes each piece you upload to its right rung and tells you what to shoot for
          the adjacent rungs of the funnel — so you&rsquo;re building a coherent monetization plan,
          not just a stack of unrelated posts.
        </p>
      </section>

      <section className="legal">
        <h2>The rules that come from this</h2>
        <ul>
          <li>
            <strong>Never post Tier 3+ for free on social.</strong> Posting a $20 PPV piece on X
            kills the sale and makes Tier 4 buyers feel taken advantage of. The Postwise enforcer
            rejects this automatically — Tier 3+ recommendations are paid-only by design.
          </li>
          <li>
            <strong>Always shoot a teaser variant.</strong> Every Tier 3–5 shoot should have a
            Tier 2 sister shot from the same setup. The Tier 2 lives on free social with a funnel
            CTA. The premium piece lives behind the paywall. The teaser&rsquo;s job is to make
            people curious enough to convert.
          </li>
          <li>
            <strong>Match price to tier × production × niche.</strong> Don&rsquo;t price a
            phone-selfie Tier 4 at studio-shoot Tier 4 rates. Production quality, scene rarity, and
            niche specificity all justify multipliers — Postwise applies them automatically.
          </li>
          <li>
            <strong>Each platform has a voice.</strong> The same image needs different captions on
            different platforms. A Reddit title is descriptive. An X post is a one-liner with link
            cue. An OnlyFans caption addresses subs personally. LinkedIn doesn&rsquo;t want a story
            it wants a lesson. Use the right voice and engagement multiplies.
          </li>
          <li>
            <strong>Trust the wisdom citations.</strong> Each recommendation cites a working
            creator&rsquo;s principle — Gary Vaynerchuk, Justin Welsh, Naval Ravikant,
            adult-industry agency playbooks. If you disagree with a recommendation, the citation
            tells you the framework behind it so you can argue with the framework, not the AI.
          </li>
        </ul>
      </section>

      <div className="cta-row" style={{ justifyContent: "center", marginTop: 32 }}>
        <Link href="/" className="btn btn-primary">Analyze something</Link>
        <Link href="/how-it-works" className="btn btn-secondary">How it works</Link>
      </div>
    </main>
  );
}
