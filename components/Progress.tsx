"use client";

import { useEffect, useState } from "react";

const STAGES: { until: number; labels: string[] }[] = [
  {
    until: 0.18,
    labels: [
      "Checking content rating",
      "Running the NSFW classifier on your pixels",
      "Setting the policy guardrails",
    ],
  },
  {
    until: 0.55,
    labels: [
      "Reading what's in your image",
      "Tagging body language and pose",
      "Detecting attire and visible body parts",
      "Reading the scene and production quality",
      "Picking out aesthetic cues",
    ],
  },
  {
    until: 0.78,
    labels: [
      "Matching against ten platforms' audiences",
      "Cross-checking platform content policies",
      "Picking your primary platform",
      "Sorting alternatives by fit",
    ],
  },
  {
    until: 0.93,
    labels: [
      "Writing captions in each platform's voice",
      "Tuning hashtags for discovery",
      "Drafting the LinkedIn variant",
      "Drafting the Instagram caption",
      "Drafting the Reddit title",
    ],
  },
  {
    until: 1.0,
    labels: [
      "Calculating pricing and strategy",
      "Pulling the right creator wisdom citation",
      "Finalizing your posting plan",
      "Almost done",
    ],
  },
];

const TOTAL_ESTIMATE = 40;
const ROTATE_MS = 2200;

export function Progress({ done, label }: { done: boolean; label?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [rotateIdx, setRotateIdx] = useState(0);

  useEffect(() => {
    if (done) return;
    const start = performance.now();
    const id = setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setRotateIdx((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [done]);

  const naturalPct = Math.min(0.97, 1 - Math.exp(-elapsed / TOTAL_ESTIMATE));
  const pct = done ? 1 : naturalPct;

  let stageLabel: string;
  if (done) {
    stageLabel = "Done";
  } else if (label) {
    stageLabel = label;
  } else {
    const stage = STAGES.find((s) => pct < s.until) ?? STAGES[STAGES.length - 1];
    stageLabel = stage.labels[rotateIdx % stage.labels.length];
  }

  return (
    <div className="progress-card">
      <p className="progress-stage">
        {!done && <span className="progress-stage-dot" />}
        {stageLabel}
      </p>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="progress-meta">
        <span>{Math.round(pct * 100)}%</span>
        <span>
          {done
            ? `${elapsed.toFixed(1)}s`
            : `~${Math.max(0, TOTAL_ESTIMATE - elapsed).toFixed(0)}s remaining`}
        </span>
      </div>
    </div>
  );
}
