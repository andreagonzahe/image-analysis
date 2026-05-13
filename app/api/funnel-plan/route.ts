import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import { fetchProfile } from "@/lib/profile-server";
import { profileSummaryForPrompt } from "@/lib/profile";
import { FRAMEWORK_PROMPT_SUMMARY } from "@/lib/creator-framework";
import { requireUserId } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-server";
import type { ImageTags } from "@/lib/captioner";
import type { ContentTier } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const BUCKET = "vault-images";
const VAULT_SIGNED_URL_TTL = 60 * 60;

type FunnelPlanRequest = {
  description: string;
  tags: ImageTags;
  content_tier: ContentTier;
  primary_platform: string;
  primary_caption?: string;
};

export type VaultMatch = {
  vault_id: string;
  image_url: string | null;
  why: string;
};

export type PlatformPlay = {
  platform: string;
  role: "post-as-is" | "shoot-teaser-variant" | "skip";
  what_to_post: string;
  caption: string;
  cadence: string;
  cta?: string;
  est_value: string;
  vault_matches?: VaultMatch[];
};

export type FunnelPlan = {
  weekly_revenue_estimate: { low: number; high: number; rationale: string };
  hero_platform: string;
  posting_order: string[];
  plays: PlatformPlay[];
};

type VaultCandidate = {
  id: string;
  image_path: string | null;
  signed_url: string | null;
  tier: number;
  scene: string;
  attire: string;
  sensuality: string;
  description: string;
  primary_platform: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FunnelPlanRequest;
    if (!body?.description || !body?.tags || !body?.primary_platform) {
      return NextResponse.json({ error: "description, tags, primary_platform required" }, { status: 400 });
    }

    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TOGETHER_API_KEY not set" }, { status: 500 });
    }
    const model = process.env.TOGETHER_STRATEGIST_MODEL || DEFAULT_MODEL;

    const [profile, vaultCandidates] = await Promise.all([
      fetchProfile(),
      fetchVaultCandidates(),
    ]);
    const profileBlock = profileSummaryForPrompt(profile);

    const platformBlock = PLATFORMS.map((p) => `- ${p.id}: ${p.paid ? "PAID" : "FREE"}, ${p.policy}, audience: ${p.audience.slice(0, 100)}`).join("\n");

    const vaultBlock = vaultCandidates.length > 0
      ? buildVaultBlock(vaultCandidates)
      : "(No matching Tier-1/Tier-2 vault items available for this user.)";

    const sys = `You are a creator-funnel strategist. Given one piece of content already analyzed by Postwise, you produce a week-long, platform-by-platform play for the creator. Connect the content to the broader funnel: top-of-funnel discovery → teaser → paywall → sale.

${FRAMEWORK_PROMPT_SUMMARY}

Output ONLY this JSON, no prose, no fences:

{
  "weekly_revenue_estimate": {
    "low": <int USD>,
    "high": <int USD>,
    "rationale": "1-2 sentences explaining what realistically drives the estimate (audience size if known, tier, platform mix)"
  },
  "hero_platform": "<the single most important platform for this piece, from the analyzed platforms list>",
  "posting_order": ["<platform_id>", "<platform_id>", ...],
  "plays": [
    {
      "platform": "<platform id>",
      "role": "post-as-is" | "shoot-teaser-variant" | "skip",
      "what_to_post": "see rules below",
      "caption": "the actual caption text in that platform's voice (REQUIRED unless role=skip)",
      "cadence": "when in a week, how often",
      "cta": "optional CTA pointing to monetization platform — for free-platform funnels promoting paid content",
      "est_value": "what this play does for the funnel — 'free reach', '$15-25 PPV unlock', '5 new subs/wk', etc.",
      "vault_match_ids": ["<vault_id>", "..."] // OPTIONAL: only for shoot-teaser-variant; ids of vault items that would work as the teaser instead of shooting new
    }
  ]
}

# what_to_post — depth required

- role=post-as-is: 1-2 sentences naming which version of THIS image goes here (e.g., "Post the original, full-color, no edits.")
- role=shoot-teaser-variant: a VIVID, specific shoot brief, 3-5 sentences, covering: pose direction, framing/crop, wardrobe specifics (color, style), lighting (golden hour, soft window, etc.), setting/scene, and the mood. Treat it like a photo direction the creator can hand to themselves or a photographer. Examples of good briefs:
  - "Shoot a Tier-2 lingerie variant in the same bedroom setting. Wear the same color palette but in a satin balconette set, posing chest-up at the edge of the bed, head tilted, looking down. Use the same warm window light. Mood: just-woke-up, intimate, soft."
  - "Outdoor swimwear teaser, golden hour at a private pool/balcony. Black bikini, hair wet and back, framing the shot from waist up with the water blurred behind. Looking off-camera with a slight smile. Mood: aspirational, sun-warm, taunting."
- role=skip: 1 sentence on why this platform genuinely doesn't apply

# Vault matching (vault_match_ids)

For each shoot-teaser-variant play, scan the "Vault candidates" list (below) and identify 0-3 existing pieces from the user's vault that would WORK as the teaser variant for this platform. Be selective: only match if the candidate genuinely fits the brief (compatible scene, attire intensity, aesthetic, production quality). If nothing fits, omit vault_match_ids or set to []. NEVER fabricate vault ids.

# Vault candidates (Tier 1-2 only — what the user already has)

${vaultBlock}

# Other rules

1. Include every platform where the creator could meaningfully act on this piece (skip ones that genuinely don't apply).
2. For Tier 3+ content: on free platforms, role MUST be "shoot-teaser-variant" or "skip" — never "post-as-is". For paid platforms, role is "post-as-is".
3. For Tier 1-2 content: on paid platforms, role is usually "shoot-teaser-variant" (suggesting a sexier complementary piece) OR "post-as-is" if it's natural loyalty content.
4. Use the creator's actively-posted platforms first when ranking.
5. The weekly revenue estimate should be honest. If they have no paid audience or this is Tier 1, estimate $0-X with rationale.
6. Captions must match platform voice (Instagram: warm + emoji; X: terse + link cue; Reddit: descriptive title; OF: intimate direct-address; etc.).
7. **Captions stand alone for this single image** — NEVER use "full set", "the set", "rest of the set", or any phrasing that implies a collection. Acceptable CTAs: "more on my OF 🔥 link in bio", "what didn't make the timeline is on Fansly", "uncropped on OF". The image speaks for itself.

# Available platforms
${platformBlock}`;

    const userPrompt = `${profileBlock ? profileBlock + "\n\n" : ""}CONTENT_TIER: ${body.content_tier}
PRIMARY_PLATFORM: ${body.primary_platform}
IMAGE_TAGS: ${JSON.stringify(body.tags)}
DESCRIPTION: ${body.description}
${body.primary_caption ? `\nPRIMARY_CAPTION: ${body.primary_caption}` : ""}

Produce the full weekly funnel plan now. Output ONLY the JSON.`;

    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Together API ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty response" }, { status: 500 });
    }

    let plan: FunnelPlan & { plays: Array<PlatformPlay & { vault_match_ids?: string[] }> };
    try {
      plan = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        plan = JSON.parse(content.slice(start, end + 1));
      } else {
        return NextResponse.json({ error: "Could not parse plan JSON" }, { status: 500 });
      }
    }

    // Resolve vault_match_ids -> objects with signed URLs
    const candidateById = new Map(vaultCandidates.map((c) => [c.id, c]));
    plan.plays = plan.plays.map((p) => {
      const ids = p.vault_match_ids ?? [];
      const matches: VaultMatch[] = ids
        .filter((id): id is string => Boolean(id) && candidateById.has(id))
        .slice(0, 3)
        .map((id) => {
          const c = candidateById.get(id)!;
          return {
            vault_id: id,
            image_url: c.signed_url,
            why: `Tier ${c.tier}, ${c.attire.replace(/_/g, " ")}, ${c.scene} — fits the brief.`,
          };
        });
      const out: PlatformPlay = { ...p };
      if (matches.length > 0) out.vault_matches = matches;
      delete (out as PlatformPlay & { vault_match_ids?: string[] }).vault_match_ids;
      return out;
    });

    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Fetch up to 50 of the user's Tier 1-2 vault items as teaser-variant candidates.
 * Server-side only; returns [] for not-signed-in users.
 */
async function fetchVaultCandidates(): Promise<VaultCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("id, image_path, analysis, content_rating, primary_platform")
    .eq("user_id", userId)
    .in("content_rating", ["SFW", "suggestive"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  // Resolve signed URLs in batch
  const paths = data.map((d) => d.image_path).filter((p): p is string => Boolean(p));
  const urlByPath: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, VAULT_SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
    }
  }

  return data.map((row) => {
    const a = (row.analysis as Record<string, unknown>) ?? {};
    const tier = Number((a as { content_tier?: number }).content_tier ?? 1);
    const tags = ((a as { tags?: Record<string, string> }).tags ?? {}) as Record<string, string>;
    return {
      id: row.id,
      image_path: row.image_path,
      signed_url: row.image_path ? urlByPath[row.image_path] ?? null : null,
      tier,
      scene: tags.scene ?? "unknown",
      attire: tags.attire ?? "unknown",
      sensuality: tags.sensuality ?? "unknown",
      description: String((a as { raw_description?: string; image_summary?: string }).image_summary ?? "").slice(0, 200),
      primary_platform: row.primary_platform ?? "",
    };
  });
}

/**
 * Compact representation of vault candidates for the LLM prompt.
 */
function buildVaultBlock(candidates: VaultCandidate[]): string {
  return candidates
    .map(
      (c, i) =>
        `${i + 1}. id="${c.id}" | tier=${c.tier} | attire=${c.attire} | scene=${c.scene} | sensuality=${c.sensuality} | summary="${c.description}"`
    )
    .join("\n");
}
