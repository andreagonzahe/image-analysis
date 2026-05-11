"use client";

import { useState } from "react";
import Link from "next/link";
import { savePost } from "@/lib/vault";
import type { FullResult } from "@/components/ResultCard";

type Props = {
  imageDataUrl: string;
  analysis: FullResult;
};

type State = "idle" | "saving" | "saved" | "error";

export function SaveButton({ imageDataUrl, analysis }: Props) {
  const [state, setState] = useState<State>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSave = async () => {
    setState("saving");
    setErrMsg(null);
    try {
      await savePost({ imageDataUrl, analysis });
      setState("saved");
    } catch (err) {
      setState("error");
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  };

  if (state === "saved") {
    return (
      <div className="save-row">
        <div className="save-saved">Saved to your vault</div>
        <Link href="/vault" className="btn-ghost" style={{ display: "inline-block" }}>
          View vault →
        </Link>
      </div>
    );
  }

  return (
    <div className="save-row">
      <button className="btn-save" onClick={onSave} disabled={state === "saving"}>
        {state === "saving" ? (
          <><span className="spinner" /> Saving…</>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Save to vault
          </>
        )}
      </button>
      {state === "error" && errMsg && <div className="error-banner" style={{ marginTop: 8 }}>{errMsg}</div>}
    </div>
  );
}
