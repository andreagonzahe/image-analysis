"use client";

import { useState } from "react";
import Link from "next/link";
import { ProfileSurvey } from "@/components/ProfileSurvey";

export default function ProfileSettingsPage() {
  const [open, setOpen] = useState(true);
  return (
    <main>
      <header className="how-hero">
        <h1 className="title">Your creator profile</h1>
        <p className="hero-sub">
          Update your niche, tone, persona, and primary platforms. Captions and recommendations
          will reflect any changes on the next analysis.
        </p>
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Edit profile
          </button>
          <Link href="/" className="btn btn-secondary">
            Back to analyzer
          </Link>
        </div>
      </header>

      {open && <ProfileSurvey forceOpen onClose={() => setOpen(false)} />}
    </main>
  );
}
