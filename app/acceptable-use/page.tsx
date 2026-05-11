export const metadata = { title: "Acceptable Use Policy — Postwise" };

export default function AcceptableUsePage() {
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">Acceptable Use Policy</h1>
        <p className="hero-sub">
          Last updated: May 11, 2026 · Operator: Andrea Gonzahe · Contact:{" "}
          <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>
        </p>
      </header>

      <div className="legal-disclaimer">
        <strong>Template notice.</strong> This document is a draft. The prohibited-content categories
        below reflect the legal minimums (CSAM, non-consensual content, etc.) that apply in
        essentially every jurisdiction. Have an attorney review for additional region-specific
        prohibitions, especially around adult content (US 18 USC 2257 record-keeping, UK Online
        Safety Act age verification, EU AVMSD, etc.) before deploying publicly.
      </div>

      <section className="legal">
        <h2>Plain-English summary</h2>
        <p>
          Postwise is a tool that helps you decide where to post your own content. You use it on
          your own AI accounts. You take responsibility for what you upload, what you post, and the
          consequences. The rules below exist because some content is illegal everywhere, and some
          content is illegal in the way it&rsquo;s being used (without consent, without rights,
          to harm someone). Violate these and you lose access to the Service, and we will cooperate
          with law enforcement.
        </p>

        <h2>1. Absolutely prohibited</h2>
        <p>You may not upload, analyze, or use the Service in connection with:</p>
        <ul>
          <li>
            <strong>Child sexual abuse material (CSAM)</strong> or any sexualized content involving
            anyone under 18, including AI-generated or stylized depictions, even if not photorealistic.
            We report CSAM to NCMEC and equivalent authorities and provide all available technical
            information.
          </li>
          <li>
            <strong>Non-consensual intimate imagery</strong> (&ldquo;revenge porn&rdquo;): explicit or
            intimate images of any person who has not given informed, specific consent to the upload
            and to the depicted use of their likeness.
          </li>
          <li>
            <strong>Deepfakes or manipulated content</strong> depicting a real person in sexual or
            compromising contexts without that person&rsquo;s informed consent.
          </li>
          <li>
            <strong>Content depicting non-consensual sexual acts</strong>, regardless of the
            apparent age or consent of any subject.
          </li>
          <li>
            <strong>Content that depicts or promotes</strong> sexual violence, bestiality, incest,
            or other content prohibited by major payment processors and platforms.
          </li>
        </ul>

        <h2>2. Rights and consent</h2>
        <p>You may not upload or analyze content unless you can affirmatively answer YES to all of:</p>
        <ul>
          <li>You own or have a license to use the image.</li>
          <li>Every identifiable person in the image is at least 18 years old.</li>
          <li>Every identifiable person has given informed consent to the depicted use, including consent to post on the platforms you plan to post to.</li>
          <li>The image does not include identifiable third parties (passers-by, etc.) in a context that would violate their reasonable expectation of privacy.</li>
        </ul>

        <h2>3. Identity and impersonation</h2>
        <p>You may not use the Service to:</p>
        <ul>
          <li>Impersonate any person or organization, including by using their photos without consent.</li>
          <li>Generate captions that fraudulently misattribute statements to a real person.</li>
          <li>Create content intended to mislead viewers about the identity of the subject or the creator.</li>
        </ul>

        <h2>4. Intellectual property</h2>
        <p>You may not upload:</p>
        <ul>
          <li>Images you do not own or have a license to use (including stock photos, professional shoots, or other people&rsquo;s art).</li>
          <li>Content protected by trademark or trade dress without authorization.</li>
          <li>Content that would infringe a platform&rsquo;s own intellectual-property policies (e.g. screenshots from copyrighted media without fair-use justification).</li>
        </ul>

        <h2>5. Harmful or illegal activity</h2>
        <p>You may not use the Service in connection with content that:</p>
        <ul>
          <li>Depicts, instructs, or promotes physical harm, self-harm, or suicide.</li>
          <li>Promotes terrorism, violent extremism, or organized hate against protected classes.</li>
          <li>Facilitates the sale of regulated goods (weapons, narcotics, prescription drugs) in violation of applicable law.</li>
          <li>Constitutes harassment, threats, doxxing, or stalking of any individual.</li>
          <li>Violates any applicable law, regulation, or third-party platform terms.</li>
        </ul>

        <h2>6. Platform compliance is your responsibility</h2>
        <p>
          Postwise recommends platforms based on best-effort matching of content tags to platform
          policies. Platforms change their rules constantly. We are not your compliance officer for
          Instagram, TikTok, OnlyFans, or any other platform. Before posting any content
          recommended by the Service, you are responsible for confirming the post complies with
          that platform&rsquo;s current Terms of Service and Community Guidelines.
        </p>

        <h2>7. No exfiltration or scraping of the Service</h2>
        <p>You may not:</p>
        <ul>
          <li>Scrape, mirror, or otherwise systematically extract data from the Service.</li>
          <li>Reverse-engineer or attempt to extract the underlying model prompts, weights, or proprietary logic.</li>
          <li>Use the Service to compete with the Service.</li>
          <li>Use automated tools to flood the Service with requests.</li>
        </ul>

        <h2>8. Adult content specifically</h2>
        <p>
          Postwise supports analysis and routing of adult content (lingerie, suggestive, nude, and
          explicit material) for adult creators. If you upload such content, additional rules apply:
        </p>
        <ul>
          <li>You confirm you and every identifiable subject are 18 or older.</li>
          <li>You confirm you are legally authorized to produce and distribute the content in your jurisdiction.</li>
          <li>You acknowledge that, in some jurisdictions, distribution of adult content requires record-keeping (US 18 USC 2257), age verification, and additional licensing. Compliance with those requirements is your responsibility, not ours.</li>
          <li>You acknowledge that platform compliance for adult content is much stricter than for SFW content, and that posting recommended adult content to a platform that prohibits it may result in account termination.</li>
        </ul>

        <h2>9. Enforcement</h2>
        <p>
          Violations of this policy will result in immediate termination of access to the Service
          and may be reported to law enforcement, payment processors, third-party platforms, and
          rights holders, as appropriate.
        </p>

        <h2>10. Reporting</h2>
        <p>
          To report a violation, including CSAM, non-consensual intimate imagery, or other
          prohibited content related to the Service, contact{" "}
          <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a> immediately. CSAM reports are
          forwarded to NCMEC (US) or your local equivalent.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this policy: <a href="mailto:andreagonzahe@gmail.com">andreagonzahe@gmail.com</a>.
        </p>
      </section>
    </main>
  );
}
