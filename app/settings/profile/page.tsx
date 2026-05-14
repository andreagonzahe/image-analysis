"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { ProfileSurvey } from "@/components/ProfileSurvey";
import {
  NICHE_OPTIONS,
  TONE_OPTIONS,
  PERSONA_OPTIONS,
  type CreatorProfile,
} from "@/lib/profile";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
const nicheLabel = (id?: string | null) => (id ? NICHE_OPTIONS.find((n) => n.id === id)?.label ?? id : "—");
const toneLabel = (id: string) => TONE_OPTIONS.find((t) => t.id === id)?.label ?? id;
const personaLabel = (id?: string | null) => (id ? PERSONA_OPTIONS.find((p) => p.id === id)?.label ?? id : "—");

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    setNeedsSignIn(false);
    fetch("/api/profile")
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401) {
          setNeedsSignIn(true);
          return;
        }
        if (!r.ok) {
          setError(data?.error || `Request failed (${r.status})`);
          return;
        }
        if (data?.enabled) setProfile((data.profile as CreatorProfile) ?? null);
        else setError("Profile sync isn't configured. Add Supabase keys to .env.local to enable cross-device profile sync.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const isEmpty = !profile || (!profile.niche && (profile.tones ?? []).length === 0 && !profile.persona && (profile.primary_platforms ?? []).length === 0);

  if (loading) {
    return (
      <main>
        <header className="how-hero">
          <h1 className="title">Your profile</h1>
          <p className="hero-sub">Loading…</p>
        </header>
      </main>
    );
  }

  if (needsSignIn) {
    return (
      <main>
        <header className="how-hero">
          <h1 className="title">Your profile</h1>
          <p className="hero-sub">
            Your creator profile (niche, persona, tone, active platforms) is stored in your account
            so it syncs across devices. Sign in to set it up — takes 30 seconds.
          </p>
        </header>
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 24 }}>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/settings/profile"
            signUpForceRedirectUrl="/settings/profile"
            appearance={{
              elements: {
                button: {
                  background: "var(--accent)",
                  color: "white",
                  border: 0,
                  padding: "12px 22px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                },
              },
            }}
          />
          <Link href="/" className="btn btn-secondary">Back to analyzer</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="profile-hero">
        <div>
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>Your creator profile</h1>
          <p className="hero-sub" style={{ margin: 0, maxWidth: 560 }}>
            Captions and recommendations are tuned to this profile. Update it any time — changes
            apply to the next analysis.
          </p>
        </div>
        <div className="cta-row" style={{ marginTop: 0 }}>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            {isEmpty ? "Set up profile" : "Edit profile"}
          </button>
          <Link href="/" className="btn btn-secondary">Back to analyzer</Link>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {isEmpty ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ marginBottom: 16, color: "var(--muted-strong)" }}>
            You haven&rsquo;t set up your profile yet. Captions will still work but they&rsquo;ll
            sound generic. Set it up — it&rsquo;s 4 quick questions.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            Set up profile
          </button>
        </div>
      ) : (
        <div className="profile-summary">
          <SummaryCard label="Niche" value={nicheLabel(profile!.niche)} detail={profile!.niche_detail ?? undefined} onEdit={() => setEditing(true)} />
          <SummaryCard
            label="Tones"
            value={(profile!.tones ?? []).length > 0 ? (profile!.tones ?? []).map(toneLabel).join(" · ") : "—"}
            onEdit={() => setEditing(true)}
          />
          <SummaryCard label="Persona" value={personaLabel(profile!.persona)} detail={profile!.persona_detail ?? undefined} onEdit={() => setEditing(true)} />
          <SummaryCard
            label="Active platforms"
            value={
              (profile!.primary_platforms ?? []).length > 0
                ? (profile!.primary_platforms ?? []).map(platformName).join(" · ")
                : "—"
            }
            onEdit={() => setEditing(true)}
          />
        </div>
      )}

      {editing && (
        <ProfileSurvey
          forceOpen
          onClose={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  onEdit,
}: {
  label: string;
  value: string;
  detail?: string;
  onEdit: () => void;
}) {
  return (
    <div className="profile-summary-card">
      <div className="profile-summary-head">
        <span className="profile-summary-label">{label}</span>
        <button className="review-edit-btn" onClick={onEdit}>Edit</button>
      </div>
      <p className="profile-summary-value">{value}</p>
      {detail && <p className="profile-summary-detail">{detail}</p>}
    </div>
  );
}
