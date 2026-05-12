export type CreatorProfile = {
  user_id?: string;
  niche?: string | null;
  niche_detail?: string | null;
  tones: string[];
  persona?: string | null;
  persona_detail?: string | null;
  primary_platforms: string[];
  audience_size?: Record<string, number> | null;
  created_at?: string;
  updated_at?: string;
};

export const NICHE_OPTIONS = [
  { id: "lifestyle", label: "Lifestyle / fashion / beauty" },
  { id: "fitness", label: "Fitness / wellness" },
  { id: "art", label: "Art / photography" },
  { id: "food", label: "Food / cooking" },
  { id: "gaming", label: "Gaming / tech" },
  { id: "business", label: "Business / entrepreneurship" },
  { id: "adult-mainstream", label: "Adult — mainstream" },
  { id: "adult-niche", label: "Adult — kink/niche" },
  { id: "creator-coach", label: "Creator coaching / business advice" },
  { id: "other", label: "Other (describe in detail)" },
];

export const TONE_OPTIONS = [
  { id: "sweet", label: "Sweet / girl-next-door" },
  { id: "confident", label: "Confident / bombshell" },
  { id: "playful", label: "Playful / silly" },
  { id: "edgy", label: "Edgy / dark" },
  { id: "luxe", label: "Luxe / aspirational" },
  { id: "witty", label: "Witty / sarcastic" },
  { id: "warm", label: "Warm / authentic" },
  { id: "professional", label: "Professional / refined" },
  { id: "dom", label: "Dominant / take-charge" },
  { id: "sub", label: "Submissive / shy" },
  { id: "intellectual", label: "Intellectual / thoughtful" },
  { id: "athletic", label: "Athletic / driven" },
];

export const PERSONA_OPTIONS = [
  { id: "girl-next-door", label: "Girl-next-door" },
  { id: "bombshell", label: "Bombshell" },
  { id: "intellectual", label: "Intellectual" },
  { id: "artist", label: "Artist" },
  { id: "athlete", label: "Athlete" },
  { id: "boss", label: "Boss / entrepreneur" },
  { id: "muse", label: "Muse / aesthetic-driven" },
  { id: "kink-specialist", label: "Kink / fetish specialist" },
  { id: "other", label: "Other (describe)" },
];

export const PRIMARY_PLATFORMS_OPTIONS = [
  "instagram",
  "tiktok",
  "x",
  "bluesky",
  "linkedin",
  "pinterest",
  "reddit-sfw",
  "reddit-nsfw",
  "x-nsfw",
  "snapchat",
  "snapchat-premium",
  "onlyfans",
  "fansly",
  "patreon",
];

export function profileIsEmpty(p: CreatorProfile | null | undefined): boolean {
  if (!p) return true;
  return !p.niche && p.tones.length === 0 && !p.persona && p.primary_platforms.length === 0;
}

/**
 * Returns a strategist-ready summary block for injection into the system prompt
 * or user message. Empty if no profile data is present.
 */
export function profileSummaryForPrompt(p: CreatorProfile | null | undefined): string {
  if (profileIsEmpty(p)) return "";
  const lines: string[] = ["# Creator profile"];
  if (p!.niche) {
    const detail = p!.niche_detail ? ` — ${p!.niche_detail}` : "";
    lines.push(`- niche: ${p!.niche}${detail}`);
  }
  if (p!.persona) {
    const detail = p!.persona_detail ? ` — ${p!.persona_detail}` : "";
    lines.push(`- persona: ${p!.persona}${detail}`);
  }
  if (p!.tones.length > 0) lines.push(`- tones (use a mix of these in captions): ${p!.tones.join(", ")}`);
  if (p!.primary_platforms.length > 0) {
    lines.push(`- creator actively posts on: ${p!.primary_platforms.join(", ")} — bias recommendations toward these when otherwise tied`);
  }
  if (p!.audience_size && Object.keys(p!.audience_size).length > 0) {
    const sizes = Object.entries(p!.audience_size)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    lines.push(`- audience size by platform: ${sizes}`);
  }
  lines.push(
    "",
    "Adjust caption voice and recommendation priority to match this profile. The persona and tones are non-negotiable — captions must sound like this creator's voice, not a generic creator's voice."
  );
  return lines.join("\n");
}
