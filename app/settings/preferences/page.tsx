"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import {
  BODY_CATEGORY_DEFS,
  type BodyCategoryId,
  type CreatorProfile,
  type RoutingRules,
} from "@/lib/profile";
import { PLATFORMS } from "@/lib/platforms";

const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/**
 * Sort key for platforms in the destination dropdowns. Order:
 *   1. OnlyFans destinations (free → wall → ppv)
 *   2. Other paid platforms (Fansly, Premium Snap, Patreon)
 *   3. Adult social (X NSFW, Reddit NSFW)
 *   4. Mainstream social
 * Within each group, alphabetical by name.
 */
function platformGroupOrder(id: string): number {
  if (id === "onlyfans_free") return 1;
  if (id === "onlyfans_wall") return 2;
  if (id === "onlyfans_ppv") return 3;
  if (id === "onlyfans") return 4; // legacy id at the bottom of the OF group
  if (id === "fansly") return 10;
  if (id === "snapchat-premium") return 11;
  if (id === "patreon") return 12;
  if (id === "x-nsfw") return 20;
  if (id === "reddit-nsfw") return 21;
  return 30;
}

const ORDERED_PLATFORMS = [...PLATFORMS].sort((a, b) => {
  const ga = platformGroupOrder(a.id);
  const gb = platformGroupOrder(b.id);
  if (ga !== gb) return ga - gb;
  return a.name.localeCompare(b.name);
});

export default function PreferencesPage() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Form state — initialized from profile, edited in place, saved on submit.
  const [routing, setRouting] = useState<RoutingRules>({});
  const [videoDest, setVideoDest] = useState<string>("");
  const [priceFloor, setPriceFloor] = useState<string>("");
  const [priceCeiling, setPriceCeiling] = useState<string>("");

  const load = () => {
    setLoading(true);
    setError(null);
    setNeedsSignIn(false);
    fetch("/api/profile")
      .then(async (r) => {
        if (r.status === 401) {
          setNeedsSignIn(true);
          return null;
        }
        if (!r.ok) throw new Error(`Could not load profile (${r.status})`);
        const data = await r.json();
        return data.profile as CreatorProfile | null;
      })
      .then((p) => {
        if (!p) return;
        setProfile(p);
        const rr = p.routing_rules ?? {};
        setRouting(rr);
        setVideoDest(rr.video_destination ?? "");
        setPriceFloor(p.price_floor_usd != null ? String(p.price_floor_usd) : "");
        setPriceCeiling(p.price_ceiling_usd != null ? String(p.price_ceiling_usd) : "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const setBodyDest = (cat: BodyCategoryId, dest: string) => {
    setRouting((cur) => ({
      ...cur,
      body_routing: { ...(cur.body_routing ?? {}), [cat]: dest || null },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const payload: Partial<CreatorProfile> = {
        ...profile,
        routing_rules: {
          body_routing: routing.body_routing ?? {},
          video_destination: videoDest || null,
        },
        price_floor_usd: priceFloor === "" ? null : Number(priceFloor),
        price_ceiling_usd: priceCeiling === "" ? null : Number(priceCeiling),
      };
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSavedMsg("Saved. New analyses will follow these rules.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const priceBoundsInvalid = useMemo(() => {
    if (priceFloor !== "" && priceCeiling !== "") {
      return Number(priceFloor) > Number(priceCeiling);
    }
    return false;
  }, [priceFloor, priceCeiling]);

  if (loading) {
    return (
      <main>
        <header className="profile-hero">
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>Posting preferences</h1>
          <p className="hero-sub">Loading…</p>
        </header>
      </main>
    );
  }

  if (needsSignIn) {
    return (
      <main>
        <header className="how-hero">
          <h1 className="title">Posting preferences</h1>
          <p className="hero-sub" style={{ maxWidth: 540, margin: "12px auto 0" }}>
            Sign in to set your own routing rules — what kind of content goes to which platform, and your price range for paid unlocks.
          </p>
        </header>
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 28 }}>
          <SignInButton mode="modal" />
          <Link href="/" className="btn btn-secondary">Back to analyzer</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="profile-hero">
        <div>
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>Posting preferences</h1>
          <p className="hero-sub" style={{ margin: 0, maxWidth: 600 }}>
            Your rules for where each type of content goes and how much it sells for.
            The strategist uses these as <strong>hard overrides</strong> — they trump
            the default tier ladder. Leave a category blank to let the strategist pick.
          </p>
        </div>
        <div className="cta-row" style={{ marginTop: 0 }}>
          <Link href="/settings/profile" className="btn btn-secondary">Profile</Link>
          <Link href="/" className="btn btn-secondary">Back</Link>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {savedMsg && (
        <div className="cta-banner cta-banner-soft" style={{ marginBottom: 18 }}>
          {savedMsg}
        </div>
      )}

      <section className="prefs-section">
        <h2 className="prefs-section-title">Content → platform rules</h2>
        <p className="prefs-section-sub">
          For each category, pick the destination platform you want for that kind of
          content. Examples: <code>Boobs → OnlyFans · Paid wall</code>, <code>Pussy → OnlyFans · PPV</code>,
          <code>Full nude → OnlyFans · PPV</code>.
        </p>
        <div className="prefs-rule-grid">
          {BODY_CATEGORY_DEFS.map((def) => (
            <div className="prefs-rule" key={def.id}>
              <div className="prefs-rule-label">
                <strong>{def.label}</strong>
                <span className="prefs-rule-detail">{def.description}</span>
              </div>
              <select
                className="prefs-rule-select"
                value={routing.body_routing?.[def.id] ?? ""}
                onChange={(e) => setBodyDest(def.id, e.target.value)}
              >
                <option value="">— No rule (strategist picks) —</option>
                {ORDERED_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="prefs-rule">
            <div className="prefs-rule-label">
              <strong>Videos (any tier)</strong>
              <span className="prefs-rule-detail">
                Forces all video uploads to this destination regardless of body category.
                Most creators route every video to PPV — videos are higher-effort and
                command higher unlock prices than stills.
              </span>
            </div>
            <select
              className="prefs-rule-select"
              value={videoDest}
              onChange={(e) => setVideoDest(e.target.value)}
            >
              <option value="">— No rule (strategist picks) —</option>
              {ORDERED_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="prefs-section">
        <h2 className="prefs-section-title">Pricing bounds</h2>
        <p className="prefs-section-sub">
          Clamps every suggested PPV / tip-unlock price to this range. The strategist
          will never go below the floor or above the ceiling for paid content. Leave a
          field blank to remove that bound.
        </p>
        <div className="prefs-price-row">
          <label className="prefs-price-field">
            <span>Minimum price (USD)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              placeholder="e.g. 10"
              value={priceFloor}
              onChange={(e) => setPriceFloor(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
          <label className="prefs-price-field">
            <span>Maximum price (USD)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              placeholder="e.g. 50"
              value={priceCeiling}
              onChange={(e) => setPriceCeiling(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
        </div>
        {priceBoundsInvalid && (
          <p className="prefs-warning">
            Minimum is higher than maximum — fix one before saving.
          </p>
        )}
      </section>

      <div className="cta-row" style={{ marginTop: 24 }}>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={saving || priceBoundsInvalid}
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setRouting({});
            setVideoDest("");
            setPriceFloor("");
            setPriceCeiling("");
          }}
          disabled={saving}
        >
          Clear all rules
        </button>
      </div>
    </main>
  );
}
