import { jsonrepair } from "jsonrepair";
import { buildSystemPrompt, userMessage, type AnalysisResult } from "./prompt";
import type { ImageTags } from "./captioner";
import type { CreatorProfile } from "./profile";
import { profileSummaryForPrompt } from "./profile";
import { recordUsage, type UsageOp } from "./usage";
import { costForTogetherCall } from "./pricing";
import { CreditExhaustedError } from "./credit-errors";

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const MAX_ATTEMPTS = 3;

export async function decideStrategy(
  description: string,
  nsfwVerdict: "nsfw" | "normal",
  tags: ImageTags,
  profile?: CreatorProfile | null,
  userId?: string | null,
  op: UsageOp = "strategist"
): Promise<AnalysisResult> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error("TOGETHER_API_KEY is not set. Get one at https://api.together.ai");
  }
  const model = process.env.TOGETHER_STRATEGIST_MODEL || DEFAULT_MODEL;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = composeUserMessage(description, nsfwVerdict, tags, profile);

  let lastError: string | null = null;
  let lastRaw: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // On retries, send the previous bad output back and ask the model to fix
    // ONLY the JSON validity, not the contents.
    const messages =
      attempt === 1 || !lastRaw
        ? [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ]
        : [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
            { role: "assistant", content: lastRaw },
            {
              role: "user",
              content: `The JSON you produced failed to parse with this error:\n${lastError}\n\nRe-output the SAME JSON but valid. Keep all the field values identical — only fix the syntax (unescaped quotes inside strings, missing commas, smart quotes, trailing commas, etc.). Output ONLY the corrected JSON, no prose.`,
            },
          ];

    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: attempt === 1 ? 0.6 : 0.2, // tighter on retries
        max_tokens: 4000, // headroom so the response doesn't get truncated mid-string
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // 402 = out of credit. 401 = invalid/missing key (functionally the
      // same outcome — every job will fail until fixed, so pause the
      // queue rather than burning attempts).
      if (res.status === 402 || res.status === 401) {
        throw new CreditExhaustedError(
          "together",
          res.status === 401 ? `API key rejected (401): ${errText}` : errText
        );
      }
      throw new Error(`Together API error ${res.status}: ${errText}`);
    }

    const body = await res.json();
    const content: string | undefined = body?.choices?.[0]?.message?.content;

    // Log cost for THIS attempt regardless of whether parsing succeeds —
    // we already paid for the inference.
    const promptTokens: number = Number(body?.usage?.prompt_tokens ?? 0);
    const completionTokens: number = Number(body?.usage?.completion_tokens ?? 0);
    recordUsage({
      user_id: userId ?? null,
      provider: "together",
      model,
      op,
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      cost_usd: costForTogetherCall(model, promptTokens, completionTokens),
      metadata: { attempt, max_attempts: MAX_ATTEMPTS },
    });

    if (!content) {
      throw new Error("Empty response from strategist model");
    }

    try {
      return extractJson(content) as AnalysisResult;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastRaw = content;
      console.warn(`Strategist JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS}:`, lastError);
      // continue to retry
    }
  }

  throw new Error(`Strategist failed to produce valid JSON after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`);
}

function composeUserMessage(
  description: string,
  nsfwVerdict: "nsfw" | "normal",
  tags: ImageTags,
  profile?: CreatorProfile | null
): string {
  const profileBlock = profileSummaryForPrompt(profile);
  const base = userMessage(description, nsfwVerdict, tags);
  if (!profileBlock) return base;
  return `${profileBlock}\n\n${base}`;
}

/**
 * Parse JSON from an LLM response. Tries strict → outermost-brace slice →
 * heuristic repair → jsonrepair (full repair-grammar parser) before giving up.
 * The last stage handles unescaped quotes inside strings, missing commas,
 * trailing commas, smart quotes, and recovers truncated outputs by closing
 * unterminated strings/arrays/objects.
 */
function extractJson(raw: string): unknown {
  const cleaned = cleanLlmOutput(raw);

  // 1. Strict parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // ignore — fall through
  }

  // 2. Slice to outermost braces and try strict again
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const sliced = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return JSON.parse(sliced);
  } catch {
    // ignore
  }

  // 3. Quick repairs (trailing commas, JS comments)
  try {
    return JSON.parse(repairJson(sliced));
  } catch {
    // ignore
  }

  // 4. Full jsonrepair — handles deep errors like unescaped quotes mid-array
  //    and gracefully closes truncated structures.
  try {
    const repaired = jsonrepair(sliced);
    return JSON.parse(repaired);
  } catch (e4) {
    throw new Error(
      `JSON parse failed after all repair strategies. Last error: ${e4 instanceof Error ? e4.message : String(e4)}. Output head: ${cleaned.slice(0, 120)}…`
    );
  }
}

function cleanLlmOutput(raw: string): string {
  let s = raw.trim();
  // Strip markdown code fences (```json ... ```)
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  // Replace smart quotes with straight quotes
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return s.trim();
}

function repairJson(s: string): string {
  let out = s;
  // Remove trailing commas before } or ]
  out = out.replace(/,\s*([}\]])/g, "$1");
  // Strip JS-style comments that some models leak
  out = out.replace(/\/\/[^\n]*/g, "");
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  return out;
}
