"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  NICHE_OPTIONS,
  TONE_OPTIONS,
  PERSONA_OPTIONS,
  PRIMARY_PLATFORMS_OPTIONS,
  type CreatorProfile,
} from "@/lib/profile";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

type Props = {
  // when true, render even if profile is non-empty (settings page)
  forceOpen?: boolean;
  onClose?: () => void;
};

export function ProfileSurvey({ forceOpen, onClose }: Props) {
  const { isLoaded, isSignedIn } = useUser();
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(Boolean(forceOpen));
  const [step, setStep] = useState(0);
  const [niche, setNiche] = useState<string>("");
  const [nicheDetail, setNicheDetail] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [persona, setPersona] = useState<string>("");
  const [personaDetail, setPersonaDetail] = useState("");
  const [primaryPlatforms, setPrimaryPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from existing profile (if any) — useful for the settings page.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.enabled) return;
        const p = data.profile as CreatorProfile | null;
        if (p) {
          setNiche(p.niche ?? "");
          setNicheDetail(p.niche_detail ?? "");
          setTones(p.tones ?? []);
          setPersona(p.persona ?? "");
          setPersonaDetail(p.persona_detail ?? "");
          setPrimaryPlatforms(p.primary_platforms ?? []);
        }
        const isEmpty = !p || (!p.niche && (p.tones ?? []).length === 0 && !p.persona && (p.primary_platforms ?? []).length === 0);
        const wasDismissed = Boolean(p?.survey_dismissed_at);
        // Auto-open only on the analyzer (home) page so the modal doesn't
        // ambush users on /today or /vault. They can re-open via /settings/profile.
        const isHomePage = typeof window !== "undefined" && window.location.pathname === "/";
        if (isEmpty && !wasDismissed && isHomePage) {
          setNeeded(true);
          setOpen(true);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn || (!open && !needed && !forceOpen)) return null;

  const toggleTone = (id: string) => {
    setTones((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, id];
    });
  };

  const togglePlatform = (id: string) => {
    setPrimaryPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche || null,
          niche_detail: nicheDetail || null,
          tones,
          persona: persona || null,
          persona_detail: personaDetail || null,
          primary_platforms: primaryPlatforms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setOpen(false);
      setNeeded(false);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    setError(null);
    try {
      // Save just the dismissal timestamp; we won't re-prompt.
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tones: [],
          primary_platforms: [],
          survey_dismissed_at: new Date().toISOString(),
        }),
      });
      setOpen(false);
      setNeeded(false);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      title: "What's your niche?",
      sub: "We use this to bias platform routing and caption topics.",
      content: (
        <>
          <div className="survey-chip-grid">
            {NICHE_OPTIONS.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`survey-chip${niche === n.id ? " survey-chip-active" : ""}`}
                onClick={() => setNiche(n.id)}
              >
                {n.label}
              </button>
            ))}
          </div>
          <label className="survey-field">
            <span>Anything specific we should know? (optional)</span>
            <input
              type="text"
              value={nicheDetail}
              onChange={(e) => setNicheDetail(e.target.value)}
              placeholder="e.g. cosplay, vintage aesthetic, MILF, fitness model…"
            />
          </label>
        </>
      ),
      canNext: Boolean(niche),
    },
    {
      title: "Pick 1–3 tones that fit your voice",
      sub: "We'll match captions to this voice across platforms.",
      content: (
        <div className="survey-chip-grid">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`survey-chip${tones.includes(t.id) ? " survey-chip-active" : ""}`}
              onClick={() => toggleTone(t.id)}
              disabled={!tones.includes(t.id) && tones.length >= 3}
            >
              {t.label}
            </button>
          ))}
        </div>
      ),
      canNext: tones.length >= 1,
    },
    {
      title: "Which archetype do you lean into?",
      sub: "Optional but recommended. Captions feel more like \"you\" with this set.",
      content: (
        <>
          <div className="survey-chip-grid">
            {PERSONA_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`survey-chip${persona === p.id ? " survey-chip-active" : ""}`}
                onClick={() => setPersona(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="survey-field">
            <span>Refine your persona (optional)</span>
            <input
              type="text"
              value={personaDetail}
              onChange={(e) => setPersonaDetail(e.target.value)}
              placeholder="e.g. 'soft dom, dreamy aesthetic', 'gym-goth', 'librarian energy'…"
            />
          </label>
        </>
      ),
      canNext: true,
    },
    {
      title: "Where do you actively post?",
      sub: "We'll bias recommendations toward platforms you're already on.",
      content: (
        <div className="survey-chip-grid">
          {PRIMARY_PLATFORMS_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={`survey-chip${primaryPlatforms.includes(id) ? " survey-chip-active" : ""}`}
              onClick={() => togglePlatform(id)}
            >
              {platformName(id)}
            </button>
          ))}
        </div>
      ),
      canNext: primaryPlatforms.length >= 1,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="survey-modal" role="dialog" aria-modal="true">
      <div className="survey-overlay" aria-hidden />
      <div className="survey-card">
        {!forceOpen && step === 0 && (
          <div className="survey-welcome">
            <span className="survey-welcome-eyebrow">Welcome to Postwise</span>
            <p className="survey-welcome-text">
              One-time setup: 4 quick questions so captions sound like you.
              Skip if you&rsquo;d rather get straight to the tool — you can fill this in later under Profile.
            </p>
          </div>
        )}
        <div className="survey-header">
          <div className="survey-progress">
            {steps.map((_, i) => (
              <span key={i} className={`survey-dot${i <= step ? " survey-dot-active" : ""}`} />
            ))}
          </div>
          {forceOpen && (
            <button className="btn-ghost" onClick={onClose} aria-label="Close">×</button>
          )}
        </div>
        <h2 className="survey-title">{current.title}</h2>
        <p className="survey-sub">{current.sub}</p>
        <div className="survey-body">{current.content}</div>
        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        <div className="survey-actions">
          {!forceOpen && (
            <button
              className="btn-ghost"
              onClick={skip}
              disabled={saving}
              style={{ marginRight: "auto" }}
            >
              Skip for now
            </button>
          )}
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              Back
            </button>
          )}
          {!isLast && (
            <button
              className="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={!current.canNext || saving}
            >
              Continue
            </button>
          )}
          {isLast && (
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!current.canNext || saving}
            >
              {saving ? "Saving…" : "Save & continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
