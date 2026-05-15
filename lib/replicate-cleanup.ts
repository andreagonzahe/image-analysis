// Replicate retention sweep.
//
// Every image we send to Replicate gets stored on their servers for ~30
// days under their default retention policy. For an adult-creator app
// that's an unacceptable exposure surface. We track every prediction we
// create (via usage_events.metadata.prediction_id) and ask Replicate to
// delete each one as soon as we can.
//
// Constraint: DELETE /v1/predictions/<id> rejects predictions younger
// than ~5 minutes. So we wait 6 minutes after creation, then sweep.
// Runs piggybacked on the existing process-jobs cron tick so we don't
// need a second scheduler.

import { getSupabase, isSupabaseConfigured } from "./supabase-server";

const REPLICATE_API = "https://api.replicate.com/v1";
const MIN_AGE_MS = 6 * 60 * 1000; // Replicate's "older than 5 min" rule + buffer
const BATCH_SIZE = 20; // delete up to this many per cron tick

type SweepResult = {
  attempted: number;
  succeeded: number;
  failed: number;
};

/**
 * Find Replicate usage_events that:
 *   - have a prediction_id stored in metadata
 *   - haven't been marked provider_deleted_at yet
 *   - are old enough that Replicate will accept the DELETE
 * Then DELETE each on Replicate and mark the row.
 *
 * Best-effort: errors are swallowed so a Replicate hiccup doesn't break
 * the worker. Returns counts for logging.
 */
export async function sweepReplicateDeletions(): Promise<SweepResult> {
  if (!isSupabaseConfigured()) return { attempted: 0, succeeded: 0, failed: 0 };

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return { attempted: 0, succeeded: 0, failed: 0 };

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();

  const { data, error } = await supabase
    .from("usage_events")
    .select("id, metadata")
    .eq("provider", "replicate")
    .is("provider_deleted_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !data || data.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const succeededIds: string[] = [];

  await Promise.all(
    data.map(async (row) => {
      const predictionId = extractPredictionId(row.metadata);
      if (!predictionId) {
        // No id to act on — mark as "deleted" so we stop reconsidering it.
        succeededIds.push(row.id as string);
        succeeded++;
        return;
      }
      try {
        const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        // 204 = deleted. 404 = already gone (still success from our side).
        // 422 = prediction too young (shouldn't happen given our cutoff, but
        //   leave the row for the next sweep instead of marking it).
        if (res.status === 204 || res.status === 404) {
          succeededIds.push(row.id as string);
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    })
  );

  if (succeededIds.length > 0) {
    await supabase
      .from("usage_events")
      .update({ provider_deleted_at: new Date().toISOString() })
      .in("id", succeededIds);
  }

  return { attempted: data.length, succeeded, failed };
}

function extractPredictionId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.prediction_id === "string" ? m.prediction_id : null;
}
