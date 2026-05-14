"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton } from "@clerk/nextjs";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const NAV: NavItem[] = [
  { href: "/", label: "Analyzer", icon: <IconAnalyze /> },
  { href: "/import", label: "Import", icon: <IconImport /> },
  { href: "/today", label: "Today", icon: <IconCalendar /> },
  { href: "/vault", label: "Vault", icon: <IconVault /> },
  { href: "/strategy", label: "Strategy", icon: <IconFunnel /> },
  { href: "/how-it-works", label: "How it works", icon: <IconBook /> },
];

const ACCOUNT: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: <IconUser /> },
];

const LEGAL: NavItem[] = [
  { href: "/terms", label: "Terms", icon: null as unknown as React.ReactNode },
  { href: "/privacy", label: "Privacy", icon: null as unknown as React.ReactNode },
  { href: "/acceptable-use", label: "Acceptable Use", icon: null as unknown as React.ReactNode },
];

type Props = {
  clerkEnabled: boolean;
  signedIn: boolean;
};

export function SideNav({ clerkEnabled, signedIn }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close drawer on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const linkClass = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `side-nav-link${active ? " side-nav-link-active" : ""}`;
  };

  return (
    <>
      {/* Mobile hamburger top bar */}
      <header className="mobile-bar">
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
        <Link href="/" className="brand brand-mobile">
          <span className="brand-mark" />
          <span>Postwise</span>
        </Link>
        {clerkEnabled && signedIn && (
          <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
        )}
      </header>

      {open && <div className="side-nav-overlay" onClick={() => setOpen(false)} aria-hidden />}

      <aside className={`side-nav${open ? " side-nav-open" : ""}`}>
        <Link href="/" className="brand brand-desktop">
          <span className="brand-mark" />
          <span>Postwise</span>
        </Link>

        <nav className="side-nav-section">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)}>
              <span className="side-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        {clerkEnabled && signedIn && (
          <nav className="side-nav-section">
            <p className="side-nav-section-label">Account</p>
            {ACCOUNT.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass(n.href)}>
                <span className="side-nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="side-nav-spacer" />

        <nav className="side-nav-section side-nav-legal">
          {LEGAL.map((n) => (
            <Link key={n.href} href={n.href} className="side-nav-legal-link">
              {n.label}
            </Link>
          ))}
        </nav>

        {clerkEnabled && (
          <div className="side-nav-auth">
            {signedIn ? (
              <div className="side-nav-userrow">
                <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
                <span className="side-nav-userlabel">Signed in</span>
              </div>
            ) : (
              <SignInButton
                mode="modal"
                appearance={{
                  elements: {
                    rootBox: { width: "100%" },
                    button: {
                      width: "100%",
                      background: "var(--accent)",
                      color: "white",
                      border: 0,
                      padding: "9px 14px",
                      borderRadius: "8px",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.15s",
                    },
                  },
                }}
              />
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/* -- icons (inline SVG to avoid extra deps) -- */

function IconImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconAnalyze() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconVault() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}
function IconFunnel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
