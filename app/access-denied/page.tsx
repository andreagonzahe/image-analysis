"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";

export default function AccessDeniedPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);

  // When this page first mounts, ask the server whether the signed-in
  // user is ACTUALLY denied or just stale-stuck. If they're allowed,
  // bounce them home — avoids the "I added myself to the allowlist
  // but I'm still on access-denied" trap.
  useEffect(() => {
    if (!user) return;
    fetch("/api/debug/whoami")
      .then((r) => r.json())
      .then((data) => {
        if (data?.server_thinks_user_is_allowed === true) {
          setRecovering(true);
          router.replace("/");
        }
      })
      .catch(() => null);
  }, [user, router]);

  if (recovering) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">You&rsquo;re on the list — redirecting you in</h1>
          <p className="hero-sub">One sec…</p>
        </header>
      </main>
    );
  }

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
