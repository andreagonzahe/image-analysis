import { buildSystemPrompt, userMessage, type AnalysisResult } from "./prompt";
import type { ImageTags } from "./captioner";
import type { CreatorProfile } from "./profile";
import { profileSummaryForPrompt } from "./profile";

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const MAX_ATTEMPTS = 3;

export async function decideStrategy(
  description: string,
  nsfwVerdict: "nsfw" | "normal",
  tags: ImageTags,
  profile?: CreatorProfile | null
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
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Together API error ${res.status}: ${errText}`);
    }

    const body = await res.json();
    const content: string | undefined = body?.choices?.[0]?.message?.content;
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
 * Parse JSON from an LLM response. Tries multiple repair strategies before
 * giving up so single-character syntax errors don't blow up the whole flow.
 */
function extractJson(raw: string): unknown {
  const cleaned = cleanLlmOutput(raw);

  // 1. Strict parse on cleaned output
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // 2. Try extracting the outermost { ... } block
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(sliced);
      } catch {
        // 3. Try repair heuristics on the sliced JSON
        try {
          return JSON.parse(repairJson(sliced));
        } catch (e3) {
          throw new Error(
            `JSON parse failed. ${e3 instanceof Error ? e3.message : String(e3)}`
          );
        }
      }
    }
    throw new Error(
      `Could not find JSON object in output. ${e1 instanceof Error ? e1.message : String(e1)}`
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
