export type CreatorProfile = {
  user_id?: string;
  niche?: string | null;
  niche_detail?: string | null;
  tones: string[];
  persona?: string | null;
  persona_detail?: string | null;
  primary_platforms: string[];
  audience_size?: Record<string, number> | null;
  survey_dismissed_at?: string | null;
  // Extended personalization
  boundaries_in: string[];
  strengths: string[];
  time_per_week?: string | null;
  revenue_target_monthly?: string | null;
  offer_mix: string[];
  // Account topology — most successful adult creators run TWO OF accounts
  // (a free promo + a paid subscription). We need to know this to size the
  // daily slot calendar correctly.
  of_account_mode?: "single" | "free_paid_pair" | null;
  fansly_account_mode?: "single" | "free_paid_pair" | null;
  created_at?: string;
  updated_at?: string;
};

export const ACCOUNT_MODE_OPTIONS = [
  { id: "single", label: "Just one account" },
  { id: "free_paid_pair", label: "Two accounts: a free promo + a paid sub" },
];

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

export const BOUNDARY_OPTIONS = [
  { id: "lifestyle", label: "Lifestyle / fully-clothed content" },
  { id: "lingerie-implied", label: "Lingerie / implied / suggestive" },
  { id: "topless-artistic", label: "Topless / artistic boudoir" },
  { id: "solo-nude", label: "Solo nude" },
  { id: "solo-explicit", label: "Solo explicit (toys / masturbation)" },
  { id: "partnered-bg", label: "Partnered (B/G)" },
  { id: "partnered-gg", label: "Partnered (G/G)" },
  { id: "group", label: "Group content" },
  { id: "outdoor-public", label: "Outdoor / public taboo" },
  { id: "kink-bdsm", label: "Specific kinks (BDSM, fetish)" },
  { id: "customs", label: "Custom commissions" },
  { id: "sexting", label: "Sexting / messaging" },
  { id: "voice-audio", label: "Voice notes / audio" },
  { id: "live-cam", label: "Live cam / video calls" },
];

export const STRENGTH_OPTIONS = [
  { id: "photography", label: "Photography / aesthetic eye" },
  { id: "storytelling", label: "Storytelling / writing" },
  { id: "humor", label: "Humor / banter" },
  { id: "dominance", label: "Dominance / direction" },
  { id: "softness", label: "Softness / nurturing" },
  { id: "education", label: "Educational / how-to" },
  { id: "lifestyle", label: "Lifestyle vlogging" },
  { id: "wit", label: "Quick wit / spontaneity" },
  { id: "production", label: "High production quality" },
  { id: "consistency", label: "Consistency / discipline" },
];

export const TIME_PER_WEEK_OPTIONS = [
  { id: "lt5", label: "Less than 5 hours/week (light hobby)" },
  { id: "5-10", label: "5–10 hours/week (side hustle)" },
  { id: "10-20", label: "10–20 hours/week (part-time business)" },
  { id: "20plus", label: "20+ hours/week (full-time)" },
];

export const REVENUE_TARGET_OPTIONS = [
  { id: "lt500", label: "Less than $500/mo (testing the waters)" },
  { id: "500-2k", label: "$500–$2K/mo (consistent side income)" },
  { id: "2k-5k", label: "$2K–$5K/mo (replacing a job)" },
  { id: "5k-15k", label: "$5K–$15K/mo (real business)" },
  { id: "15kplus", label: "$15K+/mo (top-tier)" },
];

export const OFFER_MIX_OPTIONS = [
  { id: "subscription", label: "Monthly subscription" },
  { id: "ppv", label: "PPV unlocks" },
  { id: "tip-unlock", label: "Tip-unlock posts" },
  { id: "bundles", label: "Bundles" },
  { id: "customs", label: "Custom commissions" },
  { id: "messaging", label: "Messaging / sexting club" },
  { id: "voice-audio", label: "Voice / audio content" },
  { id: "premium-tier", label: "Premium tier / VIP" },
  { id: "live-cam", label: "Live cam / video calls" },
  { id: "evergreen", label: "Evergreen store (ManyVids etc.)" },
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
  return !p.niche && (p.tones?.length ?? 0) === 0 && !p.persona && (p.primary_platforms?.length ?? 0) === 0;
}

const labelOf = <T extends { id: string; label: string }>(opts: T[], id: string) =>
  opts.find((o) => o.id === id)?.label ?? id;

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
  if ((p!.tones?.length ?? 0) > 0) {
    lines.push(`- tones (mix in captions): ${p!.tones.join(", ")}`);
  }
  if ((p!.strengths?.length ?? 0) > 0) {
    const ss = p!.strengths.map((s) => labelOf(STRENGTH_OPTIONS, s)).join(", ");
    lines.push(`- creator strengths (lean into these in captions and content suggestions): ${ss}`);
  }
  if ((p!.primary_platforms?.length ?? 0) > 0) {
    lines.push(`- actively posts on: ${p!.primary_platforms.join(", ")} — prioritize these when otherwise tied`);
  }
  if (p!.audience_size && Object.keys(p!.audience_size).length > 0) {
    const sizes = Object.entries(p!.audience_size)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    lines.push(`- audience size by platform: ${sizes}`);
  }
  if ((p!.boundaries_in?.length ?? 0) > 0) {
    const bs = p!.boundaries_in.map((b) => labelOf(BOUNDARY_OPTIONS, b)).join(", ");
    lines.push(`- content this creator IS comfortable shooting: ${bs}`);
    lines.push(`  (HARD RULE: do NOT recommend content categories not in this list. Don't suggest customs if customs aren't here, partnered if not here, etc.)`);
  }
  if ((p!.offer_mix?.length ?? 0) > 0) {
    const om = p!.offer_mix.map((o) => labelOf(OFFER_MIX_OPTIONS, o)).join(", ");
    lines.push(`- monetization modes the creator uses: ${om}`);
    lines.push(`  (Only suggest pricing for offer types in this list. Skip suggesting customs/messaging/etc. if not enabled here.)`);
  }
  if (p!.time_per_week) {
    lines.push(`- time available per week: ${labelOf(TIME_PER_WEEK_OPTIONS, p!.time_per_week)} — keep cadence advice realistic for this`);
  }
  if (p!.revenue_target_monthly) {
    lines.push(`- revenue target: ${labelOf(REVENUE_TARGET_OPTIONS, p!.revenue_target_monthly)} — scale pricing aggressiveness to match (low target = optimize unlock rate over per-piece price; high target = push higher prices and premium tiers)`);
  }
  if (p!.of_account_mode === "free_paid_pair") {
    lines.push(
      "- runs a TWO-account OnlyFans setup: a free promo account (funnel from social) + a paid sub account. When recommending OF, favor wall posts on the FREE account for Tier 1-2 funnel content, and PPV/wall on the PAID account for Tier 3+. The 'distribution_mode' field should reflect this."
    );
  }
  if (p!.fansly_account_mode === "free_paid_pair") {
    lines.push(
      "- runs a TWO-account Fansly setup (free promo + paid). Same distribution logic as the OF pair."
    );
  }
  lines.push(
    "",
    "Adjust caption voice and recommendation priority to match this profile. The persona, tones, boundaries, and offer mix are non-negotiable — captions must sound like THIS creator, and recommendations must respect what they actually do and sell."
  );
  return lines.join("\n");
}
