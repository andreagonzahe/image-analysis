export const metadata = { title: "Terms of Service — Postwise" };

export default function TermsPage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">Terms of Service</h1>
        <p className="hero-sub">
          Last updated: May 11, 2026 · Operator: Andrea Gonzahe · Contact:{" "}
          <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>
        </p>
      </header>

      <div className="legal-disclaimer">
        <strong>Template notice.</strong> This document is a draft based on common SaaS terms.
        It is not legal advice. Before deploying Postwise publicly, have these terms reviewed by a
        qualified attorney in the jurisdiction where you operate — particularly because Postwise
        supports adult-content workflows, which trigger additional regulations in some regions
        (e.g. 18 USC 2257 in the US, the Online Safety Act in the UK, AVMSD in the EU).
      </div>

      <section className="legal">
        <h2>1. Acceptance</h2>
        <p>
          By accessing or using Postwise (the &ldquo;Service&rdquo;), you agree to these Terms of
          Service. If you do not agree, do not use the Service.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and of legal age of majority in your jurisdiction to use
          the Service. By using the Service, you represent that you meet this age requirement.
        </p>
        <p>
          If any person depicted in content you upload or analyze is identifiable, you represent
          that every such person is at least 18 years old and has consented to the use of their
          likeness in the manner you intend to use it.
        </p>

        <h2>3. Description of the Service</h2>
        <p>
          Postwise analyzes user-supplied images and produces recommendations about which social
          media platforms to post on, suggested captions, posting strategy, and (for paid platforms)
          suggested pricing. The Service uses third-party AI providers (currently Replicate and
          Together AI) to process inputs. Recommendations are informational and do not guarantee
          performance, compliance, or revenue.
        </p>

        <h2>4. Your content and license</h2>
        <p>
          You retain all ownership and intellectual-property rights in the images, videos,
          captions, and other content you provide to the Service (&ldquo;User Content&rdquo;).
        </p>
        <p>
          <strong>If you use the Service without signing in</strong>, the Service does not store
          User Content on its own servers and does not store User Content on the Operator&rsquo;s
          accounts with third-party processors — User Content exists only in your browser and is
          forwarded to AI processors using your own API keys, as described in the Privacy Policy.
        </p>
        <p>
          <strong>If you sign in and save User Content to the Vault</strong>, you authorize the
          Service to store the User Content (image bytes and analysis JSON) in your own Supabase
          project, in a private storage bucket and corresponding database row, until you delete it
          via the Service. You confirm you have all rights necessary to make and authorize this
          storage. The Operator does not access, replicate, or aggregate stored Vault content across
          users.
        </p>
        <p>
          You grant the Service a limited license to process User Content for the sole purpose of
          providing recommendations and (when signed in) operating the Vault on your behalf.
        </p>
        <p>You represent and warrant that:</p>
        <ul>
          <li>You own or have all rights necessary to upload the User Content.</li>
          <li>The User Content does not infringe any third party&rsquo;s rights, including copyright, trademark, privacy, or publicity rights.</li>
          <li>Every identifiable person depicted in the User Content has given informed consent for the depicted use, and is at least 18 years old.</li>
          <li>The User Content does not depict, promote, or facilitate any of the prohibited content described in our <a href="/acceptable-use">Acceptable Use Policy</a>.</li>
        </ul>

        <h2>5. Acceptable use</h2>
        <p>
          Your use of the Service is governed by our <a href="/acceptable-use">Acceptable Use Policy</a>,
          which is incorporated into these Terms by reference. Violating that policy is grounds for
          immediate termination and may result in legal action and reporting to law enforcement.
        </p>

        <h2>6. Third-party platforms</h2>
        <p>
          The Service provides recommendations for posting on third-party platforms (Instagram,
          TikTok, X, LinkedIn, Pinterest, Bluesky, Reddit, OnlyFans, Fansly, Patreon, and others).
          The Service is not affiliated with, endorsed by, or controlled by those platforms. Each
          platform has its own terms of service and content policies, and you are solely
          responsible for complying with them when you post. We make no warranty that any
          recommendation will result in compliance, distribution, or engagement on any third-party
          platform.
        </p>

        <h2>7. AI-generated recommendations</h2>
        <p>
          The Service relies on AI models, including a binary NSFW classifier and a vision tagger.
          AI models can produce errors or misclassifications. The Service&rsquo;s recommendations
          are advisory only. You are responsible for reviewing every recommendation and caption
          before posting, and for the consequences of any post you make based on the Service.
        </p>

        <h2>8. Fees and third-party costs</h2>
        <p>
          The Service is currently provided without subscription fees. The Service consumes
          third-party AI processing credits (Replicate, Together AI) using your own API keys, which
          you are responsible for funding. We are not responsible for any charges you incur with
          those third parties.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate your access for
          any reason, including violation of these Terms or the Acceptable Use Policy, with or
          without notice.
        </p>

        <h2>10. Disclaimer of warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
          WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF
          RECOMMENDATIONS. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
        </p>

        <h2>11. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL THE OPERATOR BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING LOST PROFITS, LOST DATA, OR LOST GOODWILL, ARISING OUT OF OR IN CONNECTION
          WITH YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR ANY CLAIM SHALL NOT EXCEED ONE
          HUNDRED U.S. DOLLARS ($100) OR THE FEES YOU PAID US IN THE TWELVE MONTHS PRECEDING THE
          CLAIM, WHICHEVER IS GREATER.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless the Operator, its employees, contractors, and
          agents, from any claims, damages, losses, and expenses (including reasonable attorneys&rsquo;
          fees) arising from: (a) your User Content; (b) your violation of these Terms or the
          Acceptable Use Policy; (c) your violation of any third party&rsquo;s rights; or (d) your
          violation of any law or regulation.
        </p>

        <h2>13. Changes</h2>
        <p>
          We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date will be
          revised when we do so. Continued use of the Service after changes constitutes acceptance
          of the updated Terms.
        </p>

        <h2>14. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of California, United States, without regard to its conflict of
          laws principles. Disputes will be resolved in the courts of the State of California, United States.
        </p>

        <h2>15. Contact</h2>
        <p>
          Questions about these Terms: <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>.
        </p>
      </section>
    </main>
  );
}
