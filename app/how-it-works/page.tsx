import Link from "next/link";

export default function HowItWorks() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">How Postwise works</h1>
        <p className="hero-sub">
          The same photo can flop on Instagram and go viral on Reddit — or get your TikTok shadow-banned.
          We figure out the difference for you in under a minute, then route paid-tier content to OnlyFans, Fansly, or Patreon while building a teaser-first funnel on social.
        </p>
      </header>

      <div className="steps">
        <div className="step">
          <div className="step-num">1</div>
          <h3>You drop an image (or video)</h3>
          <p>
            Drag any photo into the analyzer — JPEG, PNG, HEIC straight from your iPhone, or a video file. Multi-drop a whole batch and walk away while we work.
          </p>
        </div>
        <div className="step">
          <div className="step-num">2</div>
          <h3>We tag it on a content ladder</h3>
          <p>
            A pixel-level NSFW classifier plus a vision tagger label every piece: attire, body parts visible, sensuality, pose, scene, production quality. From those tags we assign a tier (1=lifestyle → 5=explicit) that drives every other decision.
          </p>
        </div>
        <div className="step">
          <div className="step-num">3</div>
          <h3>You get a funnel — not just one post</h3>
          <p>
            A strategist AI matches the tier against twelve platforms&rsquo; policies, recommends where to post, writes the caption in that platform&rsquo;s voice, suggests pricing for paid platforms, and tells you what teaser to shoot to feed the funnel. <Link href="/strategy">See the full funnel logic →</Link>
          </p>
        </div>
      </div>

      <div className="section">
        <h2>Why a different caption for every platform?</h2>
        <p>
          A great Instagram caption sounds warm and personal. The same words on LinkedIn read as
          unserious. A Reddit title is short and descriptive — Instagram-style emojis and hashtags
          on Reddit get you downvoted into the void. Each platform&rsquo;s audience expects a
          specific voice, and matching that voice is the difference between 30 likes and 3,000.
        </p>
        <p>
          Postwise generates a caption per platform, not a generic one you have to rewrite four
          times. That&rsquo;s the actual work we&rsquo;re saving you.
        </p>
      </div>

      <div className="section">
        <h2>Why the funnel matters more than the post</h2>
        <p>
          The same nude photo on OnlyFans makes you $15 as a PPV. Posted for free on X, it makes you $0
          and undercuts the OF sale. Posted for free on Instagram, it gets your account shadow-banned.
          Posted as a lingerie teaser on X with a &ldquo;full set on OF&rdquo; CTA, it funnels new
          subscribers <em>to</em> the OF post. Same photo, four very different outcomes.
        </p>
        <p>
          The content ladder is what makes this routing systematic instead of accidental.{" "}
          <Link href="/strategy">Read the funnel breakdown →</Link>
        </p>
      </div>

      <div className="section">
        <h2>Why include creator quotes?</h2>
        <p>
          Anyone can ask an AI &ldquo;where should I post this&rdquo; and get a guess. What
          separates Postwise is that every recommendation cites a principle from a working creator
          — like Gary Vaynerchuk&rsquo;s &ldquo;document, don&rsquo;t create,&rdquo; or Justin
          Welsh&rsquo;s LinkedIn writing rules, or Pinterest&rsquo;s own creator guidance. The
          recommendation is the AI&rsquo;s pick. The wisdom is real.
        </p>
      </div>

      <div className="section">
        <h2>What platforms do we cover?</h2>
        <p>
          Instagram, TikTok, X (Twitter), Bluesky, LinkedIn, Pinterest, Reddit (SFW and NSFW subs),
          Snapchat (public + Premium), OnlyFans, Fansly, Patreon. Yes — including the adult platforms,
          because that&rsquo;s where a lot of creator income actually comes from in 2025+, and routing
          a paywall-bound photo to Instagram (where it would get banned) is just bad advice.
        </p>
      </div>

      <div className="section" id="privacy">
        <h2>Privacy — the honest version</h2>
        <p>
          We&rsquo;re going to tell you exactly what happens to your image, not vague reassurance.
          Four things you should know:
        </p>

        <div className="privacy-block">
          <h3><span className="icon-circle">1</span> Analysis runs on YOUR Replicate account.</h3>
          <p>
            We use <a href="https://replicate.com" target="_blank" rel="noreferrer">Replicate</a> for
            NSFW detection and tagging. This app uses YOUR Replicate API key, not a shared one.
            Predictions appear in your <a href="https://replicate.com/dashboard" target="_blank" rel="noreferrer">Replicate dashboard</a>,
            not pooled with other users. Replicate retains them for billing/audit; you can delete each
            manually. We have no way to see those records — they live on your account.
          </p>
        </div>

        <div className="privacy-block">
          <h3><span className="icon-circle">2</span> The strategist AI never sees your image — only text.</h3>
          <p>
            The platform recommendation and captions come from a separate AI (Together AI&rsquo;s
            Llama 3.3) that only receives the <em>text description</em> the tagger generates. The
            actual image never leaves the Replicate step.
          </p>
        </div>

        <div className="privacy-block">
          <h3><span className="icon-circle">3</span> Vault — depends on whether you sign in.</h3>
          <p>
            <strong>Not signed in</strong>: when you save to the Vault, the image and JSON live only
            in your browser&rsquo;s IndexedDB. Never leaves your device. Lost if you clear browser data.
          </p>
          <p>
            <strong>Signed in</strong>: we upload the image to a <strong>private</strong> bucket in
            <em> your own </em>Supabase project (<code>vault-images</code>, <code>public=false</code>).
            The analysis JSON is stored alongside in the <code>posts</code> table. Images are accessed
            only through short-lived signed URLs the server generates on demand (1-hour TTL). This is
            what lets you open your vault from a phone, a different browser, or another laptop. The
            bucket is on YOUR Supabase project — we don&rsquo;t operate a shared image pool.
          </p>
        </div>

        <div className="privacy-block">
          <h3><span className="icon-circle">4</span> Delete means delete.</h3>
          <p>
            When you delete a vault entry, we remove both the database row and the Storage object.
            Replicate prediction records you delete from your Replicate dashboard separately
            (Postwise can&rsquo;t programmatically clear them — Replicate doesn&rsquo;t expose that
            API).
          </p>
        </div>

        <p style={{ marginTop: 18 }}>
          Full details in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>

      <div className="section">
        <h2>What we don&rsquo;t do</h2>
        <p>
          We don&rsquo;t post for you, schedule for you, manage your accounts, or run analytics.
          Postwise is one specific job: looking at one piece of content and telling you where
          it&rsquo;ll perform best, what to charge if it&rsquo;s a sale, and what teaser to shoot
          to feed the funnel.
        </p>
      </div>

      <div className="cta-row">
        <Link href="/" className="btn btn-primary">Try it now</Link>
        <Link href="/strategy" className="btn btn-secondary">Read the funnel strategy</Link>
      </div>
    </main>
  );
}
