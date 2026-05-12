// Adult Creator Monetization Strategy Framework
// Source: general_creator_strategy_prompt_framework.md
// This module makes the framework's concepts available to both:
//   1. The strategist prompts (so recommendations align with the framework)
//   2. The /strategy explainer page (so visuals match the source of truth)

export type FunnelLayer = {
  id: "discovery" | "warming" | "monetization" | "high-ticket";
  label: string;
  job: string;
  platforms: string[]; // platform ids from lib/platforms.ts where applicable
  examples: string[];
};

export const FUNNEL_LAYERS: FunnelLayer[] = [
  {
    id: "discovery",
    label: "Discovery",
    job: "Get found by new people. Maximum reach, no monetization friction.",
    platforms: ["instagram", "tiktok", "x", "bluesky", "pinterest", "reddit-sfw", "snapchat"],
    examples: ["Lifestyle posts", "Trend reactions", "Aesthetic carousels", "Workout / day-in-the-life"],
  },
  {
    id: "warming",
    label: "Mid-funnel warming",
    job: "Turn followers into qualified leads via teaser content and parasocial closeness.",
    platforms: ["x", "bluesky", "reddit-nsfw", "x-nsfw", "snapchat"],
    examples: ["Lingerie / implied teasers", "Behind-the-scenes", "Stories / daily Snaps", "Reddit teaser posts with funnel CTA"],
  },
  {
    id: "monetization",
    label: "Monetization hub",
    job: "Convert leads to paying subscribers and sell PPV / tier-locked content.",
    platforms: ["onlyfans", "fansly", "patreon"],
    examples: ["Subscription content", "PPV unlocks", "Tier-locked posts", "Mass DM offers"],
  },
  {
    id: "high-ticket",
    label: "High-ticket layer",
    job: "Premium services for proven spenders. The labor-intensive offers with caps.",
    platforms: ["snapchat-premium", "onlyfans", "fansly"],
    examples: ["Custom commissions ($50–500+)", "Sexting / messaging packages", "Voice notes / audio", "Premium chat membership"],
  },
];

export type ContentPillar = {
  id: string;
  label: string;
  description: string;
  example_posts: string[];
};

export const CONTENT_PILLARS: ContentPillar[] = [
  {
    id: "main-fantasy",
    label: "Main fantasy",
    description: "The signature niche — what you're known for. Artistic nudes, cosplay, GFE, gym, alt, luxury, MILF, etc.",
    example_posts: ["Signature aesthetic shoot", "On-brand themed set", "The thing fans subscribe FOR"],
  },
  {
    id: "behind-the-scenes",
    label: "Behind-the-scenes",
    description: "Process, daily life, getting-ready, blooper-style content. Builds parasocial trust.",
    example_posts: ["Mirror selfie before a shoot", "Caption: 'this is what 6am looks like'", "Travel snaps"],
  },
  {
    id: "personality",
    label: "Personality / lifestyle",
    description: "Who you are off-content. Opinions, humor, hobbies, taste. Distinguishes you from content-only creators.",
    example_posts: ["Cooking videos", "Hot takes", "Book/movie recs", "Pet photos"],
  },
  {
    id: "premium-intimacy",
    label: "Premium intimacy",
    description: "Direct-address, parasocial closeness. Lives behind the paywall. The thing high-value subs pay for.",
    example_posts: ["DM check-ins", "Voice notes", "Custom GFE content", "Sexting / messaging"],
  },
  {
    id: "sales",
    label: "Sales / launches",
    description: "Limited-time offers, bundles, special drops. Creates urgency.",
    example_posts: ["Holiday bundle launch", "24h flash PPV", "Custom request weeks"],
  },
];

export type OfferTier = {
  id: string;
  label: string;
  audience: string;
  pricing: string;
};

export const OFFER_STACK: OfferTier[] = [
  { id: "subscription", label: "Subscription", audience: "Anyone willing to pay monthly", pricing: "$5–25/mo base" },
  { id: "ppv", label: "PPV unlock", audience: "Existing subs, sold per-piece", pricing: "$5–50 per unlock" },
  { id: "bundles", label: "Bundles", audience: "Subs who want a content library", pricing: "$25–100 per bundle" },
  { id: "customs", label: "Customs", audience: "Specific buyer with specific request", pricing: "$50–500+ per custom" },
  { id: "messaging", label: "Messaging club / premium chat", audience: "Subs who want personal access", pricing: "$15–50/mo on top of base" },
  { id: "voice-audio", label: "Voice / audio content", audience: "Audio-leaning fans", pricing: "$10–30 per audio set" },
  { id: "premium-tier", label: "Limited premium tier", audience: "High-spenders (capped roster)", pricing: "$50–200/mo, capped to 20–50 slots" },
  { id: "evergreen", label: "Evergreen store (ManyVids etc.)", audience: "Search-driven traffic, non-subs", pricing: "$5–40 per clip / bundle" },
];

export type CaptionType = {
  id: "attraction" | "curiosity" | "conversion" | "retention";
  label: string;
  job: string;
  example: string;
};

export const CAPTION_TYPES: CaptionType[] = [
  { id: "attraction", label: "Attraction", job: "Stop the scroll", example: "\"This set felt like [mood] in human form.\"" },
  { id: "curiosity", label: "Curiosity", job: "Tease missing context", example: "\"I kept the uncropped version for my paid page.\"" },
  { id: "conversion", label: "Conversion", job: "Push the unlock / subscribe", example: "\"This bundle is only up tonight.\"" },
  { id: "retention", label: "Retention", job: "Make subs feel like insiders", example: "\"You get a side of me here the timeline never sees.\"" },
];

export type DailyAction = {
  id: "discovery" | "conversion" | "retention";
  label: string;
  example: string;
};

export const DAILY_ACTIONS: DailyAction[] = [
  { id: "discovery", label: "1 discovery action", example: "Post a Tier-1 or Tier-2 teaser to X, Reddit, IG to reach new eyes" },
  { id: "conversion", label: "1 conversion action", example: "Send a mass PPV DM, drop a flash bundle, run a 24h sale" },
  { id: "retention", label: "1 retention action", example: "DM your top 10 spenders, post free-for-subs loyalty content" },
];

export type WeekDay = {
  day: string;
  job: string;
};

export const WEEKLY_SYSTEM: WeekDay[] = [
  { day: "Mon", job: "Major shoot day" },
  { day: "Tue", job: "Editing + packaging" },
  { day: "Wed", job: "Distribution-heavy: queue posts across platforms" },
  { day: "Thu", job: "Distribution-heavy: cross-post + Reddit-sub rotation" },
  { day: "Fri", job: "Sales push: mass PPV DMs, weekend bundles" },
  { day: "Sat", job: "Retention + analytics: VIP DMs, review metrics" },
  { day: "Sun", job: "Light day: scheduling, planning next week, recovery" },
];

export type SprintWeek = {
  week: 1 | 2 | 3 | 4;
  label: string;
  goals: string[];
};

export const SPRINT_30_DAY: SprintWeek[] = [
  {
    week: 1,
    label: "Brand + offer stack",
    goals: [
      "Clarify niche and persona (archetype, tone, visual identity)",
      "Rewrite all bios with one consistent brand voice",
      "Define the offer stack (sub price, PPV ranges, bundle, customs, premium tier)",
      "Organize visuals into folders by content pillar",
    ],
  },
  {
    week: 2,
    label: "Baseline library",
    goals: [
      "Shoot or batch your 30-day baseline content (3-5 pieces per pillar)",
      "Establish posting rhythm across discovery + warming channels",
      "Write first-version caption library using all 4 types (attract/curiosity/conversion/retention)",
    ],
  },
  {
    week: 3,
    label: "Upsells + segmentation",
    goals: [
      "Launch first upsell offers (PPV, bundle, or premium tier)",
      "Test 3 caption variants per platform; track which converts",
      "Segment warm buyers (top tippers, PPV unlockers, custom requesters)",
    ],
  },
  {
    week: 4,
    label: "Review + double down",
    goals: [
      "Review revenue by platform, content type, and acquisition source",
      "Cut the bottom 20% of effort (platforms or content types with weakest ROI)",
      "Double down on the formats that produced the top 20% of revenue",
      "Plan month 2 based on data, not guesses",
    ],
  },
];

export type MetricCategory = {
  id: string;
  label: string;
  metrics: string[];
};

export const METRICS: MetricCategory[] = [
  { id: "growth", label: "Audience growth", metrics: ["Followers per platform per week", "New paid subs per week"] },
  { id: "conversion", label: "Conversion", metrics: ["Free→paid conversion rate", "PPV open rate", "PPV unlock rate"] },
  { id: "revenue", label: "Revenue quality", metrics: ["Revenue per paying fan", "Average order value (PPV / customs / bundles)", "Revenue by content type", "Revenue by acquisition source"] },
  { id: "retention", label: "Retention", metrics: ["Sub retention by month", "Churn rate", "Top-spender repeat rate"] },
];

export type PersonaArchetype = {
  id: string;
  label: string;
  emotional_promise: string;
  tone_fits: string[];
};

export const ARCHETYPES: PersonaArchetype[] = [
  { id: "girl-next-door", label: "Girl-next-door / sweet", emotional_promise: "Approachable, makes them feel chosen", tone_fits: ["sweet", "warm", "playful"] },
  { id: "innocent-tease", label: "Innocent tease", emotional_promise: "Forbidden-fruit fantasy with plausible deniability", tone_fits: ["sweet", "playful", "warm"] },
  { id: "domme", label: "Domme / take-charge", emotional_promise: "Authority, control, the fantasy of being directed", tone_fits: ["dom", "confident", "witty"] },
  { id: "brat", label: "Brat / playful", emotional_promise: "Energetic banter, chase dynamic", tone_fits: ["playful", "witty", "edgy"] },
  { id: "art-muse", label: "Art muse / aesthetic", emotional_promise: "Beauty, taste, refinement", tone_fits: ["luxe", "intellectual", "warm"] },
  { id: "gamer-crush", label: "Gamer / nerdy crush", emotional_promise: "Shared niche interest leading to intimacy", tone_fits: ["playful", "witty", "warm"] },
  { id: "luxury-fantasy", label: "Luxury fantasy", emotional_promise: "Aspirational lifestyle, premium-priced experience", tone_fits: ["luxe", "professional", "confident"] },
  { id: "neighbor-milf", label: "Girl-next-door MILF", emotional_promise: "Mature confidence, attainable fantasy", tone_fits: ["warm", "confident", "sweet"] },
  { id: "gfe", label: "GFE (girlfriend experience)", emotional_promise: "Real relationship-feeling intimacy", tone_fits: ["sweet", "warm", "confident"] },
];

/**
 * Compact framework summary for injection into LLM prompts. Compact on
 * purpose — the strategist doesn't need the verbose source doc, just
 * enough to align its outputs with the framework.
 */
export const FRAMEWORK_PROMPT_SUMMARY = `
# Adult creator strategy framework (apply this throughout)

Each platform plays ONE of four funnel roles:
- discovery (top): IG, TikTok, X, Bluesky, Pinterest, Reddit-SFW, public Snap — maximum reach
- warming (middle): X-NSFW, Bluesky, Reddit-NSFW, Snap — teasers, parasocial, build qualified leads
- monetization (paywall): OnlyFans, Fansly, Patreon — subs + PPV + bundles
- high-ticket (premium): customs, sexting, voice notes, premium chat, capped premium tier

A caption is always one of FOUR types — identify which one when generating:
- attraction: stops the scroll (signature aesthetic line)
- curiosity: teases missing context ("kept the uncropped version for my paid page")
- conversion: pushes the unlock or subscribe ("this bundle is only up tonight")
- retention: makes subs feel like insiders ("you get a side of me the timeline never sees")

Daily, the creator should do 3 actions: one discovery, one conversion, one retention.

Don't give away premium intimacy cheaply. GFE, custom messaging, voice notes — these are HIGH-TICKET capped offers, not base-subscription perks.
`;
