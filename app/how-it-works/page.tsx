import Link from "next/link";

export default function HowItWorks() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">How Postwise works</h1>
        <p className="hero-sub">
          The same photo can flop on Instagram and go viral on Reddit — or get your TikTok shadow-banned.
          We figure out the difference for you in under 20 seconds.
        </p>
      </header>

      <div className="steps">
        <div className="step">
          <div className="step-num">1</div>
          <h3>You drop an image</h3>
          <p>
            Drag any photo into the analyzer — JPEG, PNG, HEIC straight from your iPhone, anything.
            Your image stays on your device. Nothing is saved on our servers.
          </p>
        </div>
        <div className="step">
          <div className="step-num">2</div>
          <h3>We read what&rsquo;s in it</h3>
          <p>
            A vision AI describes your image in detail — the subject, the vibe, the framing, the
            audience it would resonate with. This is the same kind of content analysis a savvy
            social strategist would do by eye.
          </p>
        </div>
        <div className="step">
          <div className="step-num">3</div>
          <h3>You get a posting plan</h3>
          <p>
            We match the content against ten platforms — their audiences, what their algorithms
            reward, what their content policies forbid — and write captions in each platform&rsquo;s
            voice. With reasons. And quotes from creators who&rsquo;ve made it work.
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
        <h2>Why include creator quotes?</h2>
        <p>
          Anyone can ask an AI &ldquo;where should I post this&rdquo; and get a guess. What
          separates Postwise is that every recommendation cites a principle from a working creator
          — like Gary Vaynerchuk&rsquo;s &ldquo;document, don&rsquo;t create,&rdquo; or Justin
          Welsh&rsquo;s LinkedIn writing rules, or Pinterest&rsquo;s own creator guidance. The
          recommendation is the AI&rsquo;s pick. The wisdom is real.
        </p>
        <p>
          If you don&rsquo;t agree with a recommendation, the quoted principle tells you the
          framework behind it — so you can argue with the framework instead of just the AI.
        </p>
      </div>

      <div className="section">
        <h2>What platforms do we cover?</h2>
        <p>
          Instagram, TikTok, X (Twitter), LinkedIn, Pinterest, Reddit (SFW and NSFW subs),
          OnlyFans, Fansly. Yes — including the adult platforms, because that&rsquo;s where a lot
          of creator income actually comes from in 2025+, and routing a paywall-bound photo to
          Instagram (where it would get banned) is just bad advice.
        </p>
      </div>

      <div className="section" id="privacy">
        <h2>Privacy — the honest version</h2>
        <p>
          We&rsquo;re going to tell you exactly what happens to your image, not vague reassurance. Three
          things you should know:
        </p>

        <div className="privacy-block">
          <h3><span className="icon-circle">1</span> We don&rsquo;t save your image. Anywhere.</h3>
          <p>
            Our app has no database. No file storage. No image bucket. Your photo passes through our
            code as in-memory bytes for a few seconds, gets forwarded to the AI vision model, and is
            then garbage-collected. Nothing about your image is logged, written to disk, or kept
            after the request.
          </p>
        </div>

        <div className="privacy-block">
          <h3><span className="icon-circle">2</span> The AI vision processing runs on YOUR Replicate account.</h3>
          <p>
            We use <a href="https://replicate.com" target="_blank" rel="noreferrer">Replicate</a> for
            the NSFW detection and image-tagging steps. Crucially: this app uses YOUR Replicate API
            key, not a shared one. Predictions appear in <a href="https://replicate.com/dashboard" target="_blank" rel="noreferrer">your own Replicate dashboard</a>,
            not a pool with other users. Replicate retains them for billing and account history, and
            you can delete each one manually from that dashboard. There&rsquo;s no way for us to see
            those records — they live on your account.
          </p>
        </div>

        <div className="privacy-block">
          <h3><span className="icon-circle">3</span> The strategist AI never sees your image — only text.</h3>
          <p>
            The platform recommendation and captions come from a separate AI (Together AI&rsquo;s Llama
            3.3) that only receives the <em>text description</em> generated by Replicate. The actual
            image never leaves the Replicate step. Together AI processes anonymous text prompts and
            doesn&rsquo;t see, store, or train on your photo.
          </p>
        </div>

        <p style={{ marginTop: 18 }}>
          If you want a truly zero-trace workflow, run this app on your own machine (you already are
          — it&rsquo;s localhost), use a fresh Replicate API key just for it, and clear predictions
          from your Replicate dashboard after each session.
        </p>
      </div>

      <div className="section">
        <h2>What we don&rsquo;t do</h2>
        <p>
          We don&rsquo;t post for you, schedule for you, manage your accounts, or run analytics.
          Postwise is one specific job: looking at one image and telling you where it&rsquo;ll
          perform best. Use your existing scheduler (Later, Buffer, Hootsuite, or your platform&rsquo;s
          native scheduler) for the actual posting.
        </p>
      </div>

      <div className="cta-row">
        <Link href="/" className="btn btn-primary">Try it now</Link>
      </div>
    </main>
  );
}
