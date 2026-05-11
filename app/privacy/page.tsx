export const metadata = { title: "Privacy Policy — Postwise" };

export default function PrivacyPage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">Privacy Policy</h1>
        <p className="hero-sub">
          Last updated: May 11, 2026 · Operator: Andrea Gonzahe · Contact:{" "}
          <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>
        </p>
      </header>

      <div className="legal-disclaimer">
        <strong>Template notice.</strong> This document is a draft. It reflects how Postwise
        currently handles data, but the document itself has not been reviewed by an attorney. If you
        deploy Postwise publicly, especially in regions with GDPR (EU/UK), CCPA/CPRA (California),
        LGPD (Brazil), or PIPEDA (Canada), have this policy reviewed by counsel and adjusted for
        your specific data flows and any analytics or cookies you add.
      </div>

      <section className="legal">
        <h2>1. What we collect</h2>
        <p>
          The short version: we don&rsquo;t store your images. The long version below describes
          every piece of data that flows through the Service and where it ends up.
        </p>

        <h2>2. Information you provide</h2>
        <p>
          <strong>Images.</strong> When you upload an image to be analyzed, the image is transmitted
          from your browser to our server only long enough to forward it to the AI processing
          providers described below. It is never written to disk on our side and is not retained
          after the request completes.
        </p>
        <p>
          <strong>API keys.</strong> Postwise uses your own API keys for Replicate and Together AI.
          These keys are stored locally in your environment configuration and are never transmitted
          to our servers in production. We do not collect, store, or have access to your keys.
        </p>
        <p>
          <strong>Vault data.</strong> If you save an analysis to the Vault, the image and the
          analysis are stored in IndexedDB inside your browser. They never leave your device. If
          you clear your browser data or use a different device, vault contents are not synced.
        </p>

        <h2>3. Information we automatically receive</h2>
        <p>
          The Service does not use cookies, analytics, third-party trackers, or session
          fingerprinting. We do not log IP addresses, user-agent strings, or referral information
          beyond what is required for transient HTTP responses.
        </p>

        <h2>4. Third-party processing</h2>
        <p>
          To produce recommendations, the Service uses two third-party AI processors. We call them
          out individually so you know exactly what they each see.
        </p>
        <ul>
          <li>
            <strong>Replicate</strong> (<a href="https://replicate.com/privacy" target="_blank" rel="noreferrer">replicate.com/privacy</a>):
            Receives your image to perform NSFW classification and structured tagging. Replicate
            retains prediction records (input + output) on your own Replicate account dashboard for
            billing and audit. You can manually delete predictions from that dashboard at any time.
            Because Postwise uses your own Replicate API key, these records are on your account, not
            the operator&rsquo;s.
          </li>
          <li>
            <strong>Together AI</strong> (<a href="https://www.together.ai/legal/privacy-policy" target="_blank" rel="noreferrer">together.ai/legal/privacy-policy</a>):
            Receives the text description Replicate generates and writes platform recommendations
            and captions. Together AI never receives your image. It receives only the text
            description that Replicate produces.
          </li>
        </ul>

        <h2>5. How we use information</h2>
        <p>The Service uses the information you provide for exactly one purpose: to return platform recommendations to you in the same session. No other use.</p>
        <p>We do not:</p>
        <ul>
          <li>Sell your data.</li>
          <li>Use your data for advertising or marketing.</li>
          <li>Train any AI model on your data.</li>
          <li>Share your data with any party other than the third-party processors listed above and only for the purpose of providing the Service.</li>
        </ul>

        <h2>6. Retention</h2>
        <ul>
          <li><strong>On our servers</strong>: zero retention. Images and the text descriptions exist only in memory during the request.</li>
          <li><strong>On your Replicate account</strong>: predictions persist until you delete them in the Replicate dashboard.</li>
          <li><strong>On Together AI</strong>: governed by their privacy policy; we do not control retention there.</li>
          <li><strong>In your browser&rsquo;s vault</strong>: until you delete the entry or clear browser data.</li>
        </ul>

        <h2>7. Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, port, or delete your
          personal data, and to object to or restrict its processing. Because the Service does not
          maintain a database of users or content, requests to access or delete personal data from
          our servers will typically result in confirmation that no such data exists. For deletion
          of predictions stored on Replicate or Together AI, follow those providers&rsquo;
          processes directly.
        </p>
        <p>To exercise rights or ask questions: <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>.</p>

        <h2>8. Security</h2>
        <p>
          We use industry-standard transport security (HTTPS) for all communications. Because we do
          not retain images or analysis results on our servers, the risk surface for a server
          breach is limited to in-flight requests. We cannot speak to the security of your browser,
          your operating system, or the third-party providers.
        </p>

        <h2>9. Children</h2>
        <p>
          The Service is intended for users 18 and older. We do not knowingly collect data from
          anyone under 18. If you believe a person under 18 is using the Service, contact us so we
          can take appropriate action.
        </p>

        <h2>10. International transfers</h2>
        <p>
          Third-party processors (Replicate, Together AI) may store and process data in the United
          States and other regions. By using the Service, you acknowledge that your data may be
          transferred to and processed in countries other than your own, including countries that
          may have different data protection laws than your jurisdiction.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date
          will be revised when we do so. Material changes will be noted prominently in the Service
          where practical.
        </p>

        <h2>12. Contact</h2>
        <p>
          For privacy questions: <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>.
        </p>
      </section>
    </main>
  );
}
