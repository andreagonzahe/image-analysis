import { buildSystemPrompt, userMessage, type AnalysisResult } from "./prompt";
import type { ImageTags } from "./captioner";
import type { CreatorProfile } from "./profile";
import { profileSummaryForPrompt } from "./profile";

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

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

  const res = await fetch(TOGETHER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: composeUserMessage(description, nsfwVerdict, tags, profile) },
      ],
      temperature: 0.6,
      max_tokens: 1200,
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
  return extractJson(content) as AnalysisResult;
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

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`Could not parse JSON from strategist output: ${trimmed.slice(0, 200)}`);
  }
}
