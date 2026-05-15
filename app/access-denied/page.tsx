"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";

export default function AccessDeniedPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <main>
      <header className="hero">
        <h1 className="title">Not on the allowlist</h1>
        <p className="hero-sub">
          Postwise is in private beta. Only invited email addresses can use it
          right now. If you think this is a mistake, ping the person who pointed
          you here.
        </p>
        {email && (
          <p className="hero-sub" style={{ marginTop: 12, fontSize: 13.5, opacity: 0.75 }}>
            Signed in as <strong>{email}</strong>.
          </p>
        )}
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
          <SignOutButton>
            <button className="btn btn-secondary">Sign out</button>
          </SignOutButton>
        </div>
      </header>
    </main>
  );
}
