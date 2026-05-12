"use client";

import { useEffect, useState } from "react";

const ANALYZING_STAGES: { until: number; labels: string[] }[] = [
  {
    until: 0.18,
    labels: ["Checking content rating", "Running the NSFW classifier", "Setting guardrails"],
  },
  {
    until: 0.55,
    labels: [
      "Reading what's in the image",
      "Tagging body language and pose",
      "Detecting attire and visible body parts",
      "Reading scene and production quality",
    ],
  },
  {
    until: 0.78,
    labels: [
      "Matching platforms",
      "Cross-checking content policies",
      "Picking the primary platform",
    ],
  },
  {
    until: 0.93,
    labels: [
      "Writing captions",
      "Tuning hashtags",
      "Drafting alternatives",
    ],
  },
  {
    until: 1.0,
    labels: [
      "Calculating pricing",
      "Pulling the right wisdom citation",
      "Almost done",
    ],
  },
];

const ANALYZE_ESTIMATE_SECONDS = 40;
const ROTATE_MS = 2200;

export function TileProgress({
  startedAt,
  phase,
}: {
  startedAt: number;
  phase: "preparing" | "analyzing";
}) {
  const [elapsed, setElapsed] = useState(0);
  const [rotateIdx, setRotateIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 200);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const id = setInterval(() => setRotateIdx((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  if (phase === "preparing") {
    return (
      <div className="tile-progress">
        <div className="tile-progress-row">
          <span className="spinner-small" />
          <span className="tile-progress-label">Reading image…</span>
          <span className="tile-progress-time">{elapsed.toFixed(0)}s</span>
        </div>
      </div>
    );
  }

  const pct = Math.min(0.97, 1 - Math.exp(-elapsed / ANALYZE_ESTIMATE_SECONDS));
  const stage = ANALYZING_STAGES.find((s) => pct < s.until) ?? ANALYZING_STAGES[ANALYZING_STAGES.length - 1];
  const label = stage.labels[rotateIdx % stage.labels.length];
  const remaining = Math.max(0, ANALYZE_ESTIMATE_SECONDS - elapsed);

  return (
    <div className="tile-progress">
      <div className="tile-progress-row">
        <span className="spinner-small" />
        <span className="tile-progress-label">{label}</span>
        <span className="tile-progress-pct">{Math.round(pct * 100)}%</span>
      </div>
      <div className="tile-progress-bar">
        <div className="tile-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="tile-progress-meta">
        <span>{elapsed.toFixed(0)}s elapsed</span>
        <span>~{Math.ceil(remaining)}s remaining</span>
      </div>
    </div>
  );
}
