"use client";

import { useEffect, useRef } from "react";

/**
 * Global background-import driver. Mounted once at the layout level so it
 * survives any page navigation. While the user has any "running" job batch,
 * this chain-fires POST /api/cron/process-jobs as fast as the worker can
 * resolve — exactly the same loop the import status page runs, just hoisted
 * up to the whole app.
 *
 * State machine:
 *   IDLE      → poll /api/jobs/batches/active every 30s
 *   when active batches > 0 → fire cron, then chain-fire as long as it's
 *     reporting non-zero work; back off to 6s if cron reports idle
 *   when active batches go to 0 → back to IDLE polling
 *
 * Only runs when the user is signed in. Renders nothing.
 */
export function BatchChecker({ signedIn }: { signedIn: boolean }) {
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!signedIn) return;
    stoppedRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number, fn: () => void) => {
      if (stoppedRef.current) return;
      timer = setTimeout(fn, delayMs);
    };

    const hasActiveBatches = async (): Promise<boolean> => {
      try {
        const res = await fetch("/api/jobs/batches/active");
        if (!res.ok) return false;
        const data = await res.json();
        return Array.isArray(data?.batches) && data.batches.length > 0;
      } catch {
        return false;
      }
    };

    const fireCron = async (): Promise<boolean> => {
      try {
        const res = await fetch("/api/cron/process-jobs", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        // "idle" = no jobs were processed this tick. Either the queue is
        // empty or everything that could be claimed is rate-limited/backed off.
        return body?.message === "No pending jobs." || (body?.processed ?? 0) === 0;
      } catch {
        return true; // treat as idle so we back off
      }
    };

    const loop = async () => {
      if (stoppedRef.current) return;
      const active = await hasActiveBatches();
      if (!active) {
        // No work for this user. Check again in 30s — cheap heartbeat.
        schedule(30_000, loop);
        return;
      }
      // We have work. Fire the cron and chain.
      const idle = await fireCron();
      // If idle (rate-limited or queue empty), back off 6s. Otherwise fire
      // again as soon as React releases the microtask — the just-resolved
      // tick freed worker capacity and the cron is doing the rate-limit
      // shaping anyway.
      schedule(idle ? 6_000 : 0, loop);
    };

    // Kick off after a tiny delay so the rest of the page loads first.
    schedule(2_000, loop);

    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [signedIn]);

  return null;
}
