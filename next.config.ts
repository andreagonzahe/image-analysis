import type { NextConfig } from "next";

/**
 * Content-Security-Policy. Tightened enough to block the realistic
 * exfiltration vectors (3rd-party script injection, unauthorized image
 * sources) while still allowing the providers we actually rely on:
 *   - Clerk (auth) — needs scripts + connect-src
 *   - Supabase (data + storage) — connect + img
 *   - Replicate / Together (server-side only, no client connect needed)
 *
 * 'unsafe-inline' for styles is required by Clerk's injected components.
 * 'unsafe-eval' is required because Next 16 + Turbopack uses eval in dev
 * for HMR; in production we could tighten this but keeping it consistent
 * avoids dev/prod CSP drift.
 */
const csp = [
  "default-src 'self'",
  // Scripts: self + Clerk's hosted JS. 'unsafe-inline' needed for Next's
  // inline bootstrap script. 'unsafe-eval' needed by Turbopack/Next runtime.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://js.clerk.com",
  // Styles: Clerk injects inline styles for its dropdowns/modals.
  "style-src 'self' 'unsafe-inline'",
  // Images: vault thumbnails come from blob: (IndexedDB), data: (upload
  // previews), Supabase signed URLs, Dropbox content URLs, and our own
  // /api/dropbox/thumbnail proxy (which is just 'self').
  "img-src 'self' data: blob: https://*.supabase.co https://*.dropboxusercontent.com",
  // Fonts inline only.
  "font-src 'self' data:",
  // Outbound API calls from the browser: our own API, Clerk, Supabase.
  // Replicate/Together are server-side only — never called from the browser.
  "connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://*.supabase.co",
  // No <iframe> embedding of us by anyone (anti-clickjacking).
  "frame-ancestors 'none'",
  // Clerk uses iframes for some auth flows — allow Clerk to be framed by us.
  "frame-src https://*.clerk.com https://*.clerk.accounts.dev",
  // Block inline plugins (flash/etc).
  "object-src 'none'",
  // Force HTTPS for any subresource that escaped our explicit allowlist.
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  // Anti-clickjacking belt + suspenders (CSP frame-ancestors already covers this for modern browsers).
  { key: "X-Frame-Options", value: "DENY" },
  // Tell the browser to never sniff the response type — protects against
  // mismeasured content-type attacks.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL (which can include vault id, batch id) to
  // external links the user clicks.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No automatic camera / mic / geolocation. Tighten as we add features.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// CSP in dev mode is brittle — Turbopack's HMR injects styles via paths
// the static CSP doesn't predict, and Safari enforces stricter than
// Chrome, so dev gets blank-page'd. Only emit CSP in production builds;
// dev still gets all the other (non-breaking) security headers.
const isProd = process.env.NODE_ENV === "production";
const HEADERS_FOR_THIS_ENV = isProd
  ? SECURITY_HEADERS
  : SECURITY_HEADERS.filter((h) => h.key !== "Content-Security-Policy");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: HEADERS_FOR_THIS_ENV,
      },
    ];
  },
};

export default nextConfig;
