"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "postwise:age-confirmed-v1";

export function AgeGate() {
  const [hydrated, setHydrated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setConfirmed(true);
    } catch {
      // localStorage may be unavailable (private mode); fall through and require confirmation each session
    }
  }, []);

  if (!hydrated || confirmed) return null;

  const onConfirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — confirmation will just be required again next visit
    }
    setConfirmed(true);
  };

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate-card">
        <h2 id="age-gate-title" className="age-gate-title">Before you continue</h2>
        <p className="age-gate-sub">
          Postwise supports analysis and routing of adult content. Please confirm both before continuing.
        </p>

        <label className="age-gate-row">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            I am at least 18 years old, and every identifiable person in any content I upload is at
            least 18 years old.
          </span>
        </label>

        <label className="age-gate-row">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <span>
            I have read and agree to the <Link href="/terms" target="_blank">Terms</Link>,{" "}
            <Link href="/privacy" target="_blank">Privacy Policy</Link>, and{" "}
            <Link href="/acceptable-use" target="_blank">Acceptable Use Policy</Link>.
          </span>
        </label>

        <div className="age-gate-actions">
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!checked || !acceptedTerms}
          >
            Enter Postwise
          </button>
        </div>
      </div>
      <div className="age-gate-overlay" aria-hidden />
    </div>
  );
}
