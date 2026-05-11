export type ContentPolicy = "no-nudity" | "suggestive-ok" | "explicit-ok";

export type CreatorWisdom = {
  id: string;
  principle: string;
  attribution: string;
  context: string;
};

export type Platform = {
  id: string;
  name: string;
  policy: ContentPolicy;
  paid: boolean;
  audience: string;
  captionStyle: string;
  hashtagNorm: string;
  bestFor: string;
  whyItWorks: string;
  whyToAvoid: string;
  wisdom: CreatorWisdom[];
  composeUrl: string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    policy: "no-nudity",
    paid: false,
    audience: "Broad consumer, 18-45, lifestyle and aesthetic-driven",
    captionStyle: "1-3 sentences, warm and personal, can include a CTA. Emojis welcome.",
    hashtagNorm: "5-15 hashtags, mix of broad and niche",
    bestFor: "High-quality lifestyle, fashion, food, travel, portraits (clothed)",
    whyItWorks: "Instagram rewards visually polished content with strong save-and-share rates. The audience treats their feed as a curated inspiration board, so anything that looks like a magazine page tends to outperform.",
    whyToAvoid: "Instagram's classifier aggressively flags nudity, even artistic. Posts get shadow-banned without notice — your follower count stays the same but reach drops to near-zero, often permanently for the account.",
    composeUrl: "https://www.instagram.com/create/select/",
    wisdom: [
      { id: "ig-document", principle: "Document, don't create", attribution: "Gary Vaynerchuk", context: "Vaynerchuk argues behind-the-scenes and casual content outperforms over-produced posts because it feels human. Especially true for Instagram in 2025+ where over-curation reads as inauthentic." },
      { id: "ig-first-line", principle: "The first line is the hook. Treat it like a thumbnail.", attribution: "Latasha James, creator coach", context: "Only the first ~125 characters show before the 'more' tap. If line one doesn't earn the tap, the rest doesn't exist." },
      { id: "ig-carousels", principle: "Carousels outperform single images on saves and shares", attribution: "Adam Mosseri (Head of Instagram), in his weekly creator updates", context: "Mosseri has repeatedly confirmed carousels get the most engagement per impression because they reach swipers AND non-swipers in the algorithm." },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    policy: "no-nudity",
    paid: false,
    audience: "Gen Z and younger millennials, trend-driven",
    captionStyle: "Short, punchy, trend-referencing. Lowercase often. Hook in first 5 words.",
    hashtagNorm: "3-5 trending hashtags",
    bestFor: "Video content primarily; for stills, only memes or trend-screenshot reactions",
    whyItWorks: "TikTok's For You algorithm rewards retention. A still image as a 'photo carousel' can work if it has a clear hook and the trend wave is fresh.",
    whyToAvoid: "TikTok's automated moderation is the strictest of any major platform — even cleavage in swimwear gets demoted. Strikes accumulate fast and accounts get age-restricted with no appeal.",
    composeUrl: "https://www.tiktok.com/upload",
    wisdom: [
      { id: "tt-3-seconds", principle: "Stop the scroll in the first 1-3 seconds or you've lost them", attribution: "TikTok's own Creator Portal guidance", context: "TikTok's algorithm decides whether to keep showing your content based on retention in the first 3 seconds. The first frame is effectively your thumbnail." },
      { id: "tt-skip-intro", principle: "Hooks, not intros — skip the 'hey guys, welcome back'", attribution: "Brendan Kane, Hook Point", context: "Anything that delays the value proposition costs you the swipe. Start at the most interesting frame." },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    policy: "suggestive-ok",
    paid: false,
    audience: "News, tech, commentary; varies wildly by sub-community",
    captionStyle: "Concise, witty, opinionated. Often no hashtags. Can be edgy.",
    hashtagNorm: "0-2 hashtags max",
    bestFor: "Memes, news takes, commentary, suggestive-but-not-explicit content (with sensitive media flag)",
    whyItWorks: "X is the only major platform where the text is as important as the image. Images that need a witty caption to land — memes, reactions, observations — thrive here.",
    whyToAvoid: "X has the fastest decay rate of any platform. A post is dead in 6 hours. If your image is evergreen (cookbook, portrait), you're burning content here that would compound elsewhere.",
    composeUrl: "https://x.com/compose/post",
    wisdom: [
      { id: "x-specificity", principle: "Specificity beats abstraction", attribution: "Sahil Bloom", context: "Bloom's framework: a tweet with a specific number, name, or detail outperforms a generalized version of the same idea by 5-10x in saves." },
      { id: "x-first-lines", principle: "Posts are first lines of the bigger story you're telling", attribution: "Naval Ravikant", context: "Naval's approach: every post should make people want to know who wrote it. Coherent personal brand compounds, scattered takes don't." },
    ],
  },
  {
    id: "bluesky",
    name: "Bluesky",
    policy: "suggestive-ok",
    paid: false,
    audience: "Early adopters, tech-leaning, ex-Twitter migrants — generally chiller than X, more curious, smaller but engaged",
    captionStyle: "Like X but less aggressive. Personality-driven, conversational. Content warnings (labels) are normal and respected.",
    hashtagNorm: "0-2 hashtags; the platform doesn't surface hashtags as strongly as X",
    bestFor: "Art, photography, tech commentary, behind-the-scenes; suggestive content with proper labels",
    whyItWorks: "Bluesky's algorithm is opt-in via custom feeds, which means engaged niches actually find you. Smaller reach than X but much higher engagement-per-impression and far less hostility.",
    whyToAvoid: "Reach is still modest compared to X. If you're trying to maximize one-shot virality, this isn't it yet — it rewards consistent presence over time.",
    composeUrl: "https://bsky.app/",
    wisdom: [
      { id: "bsky-labels", principle: "Use content labels generously — they're a feature, not a punishment", attribution: "Bluesky's own moderation guidance", context: "Unlike Twitter's binary sensitive-media flag, Bluesky lets users self-select what they want to see via custom labels. Properly labeled adult/sensitive content reaches its right audience without being throttled." },
      { id: "bsky-vibe", principle: "It's Twitter pre-2015 — be a person, not a brand", attribution: "Common Bluesky community sentiment among early adopters", context: "The norm here is conversational, weird, personal. Polished brand-voice posts read as out of place. Lean into the chiller, more curious tone." },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    policy: "no-nudity",
    paid: false,
    audience: "Professionals, 25-55, career-focused",
    captionStyle: "Longer-form storytelling, professional tone, lessons-learned framing. No slang.",
    hashtagNorm: "3-5 professional hashtags",
    bestFor: "Professional headshots, workplace, achievements, infographics",
    whyItWorks: "LinkedIn's feed favors text-with-image posts that drive comments. A photo paired with a 100-200 word reflection consistently outperforms standalone images by an order of magnitude.",
    whyToAvoid: "Anything that reads as casual, irreverent, or off-topic tanks. LinkedIn users are signaling professional credibility — your post becomes part of how strangers judge them by association.",
    composeUrl: "https://www.linkedin.com/feed/?shareActive=true",
    wisdom: [
      { id: "li-write-like-talk", principle: "Write like you talk — kill the corporate jargon", attribution: "Justin Welsh, solopreneur", context: "Welsh built a $5M+ solo business largely from LinkedIn. His core advice: read your draft aloud. If it doesn't sound like you, delete it." },
      { id: "li-story-lesson-takeaway", principle: "Story, lesson, takeaway — that's the format", attribution: "Justin Welsh", context: "The top-performing LinkedIn posts follow a three-act structure: personal story (1-2 lines), what it taught you (2-3 lines), what the reader should do with it (1 line)." },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    policy: "no-nudity",
    paid: false,
    audience: "Predominantly women 25-54, planning and inspiration mindset",
    captionStyle: "Descriptive, keyword-rich, SEO-style. Describes what the image IS for searchability.",
    hashtagNorm: "Keywords matter more than hashtags",
    bestFor: "Recipes, DIY, fashion, home decor, aesthetic inspiration",
    whyItWorks: "Pinterest is search, not social — pins keep getting found for months or years. A well-tagged image from 2 years ago can still drive daily traffic.",
    whyToAvoid: "Anything ephemeral (memes, news takes, in-the-moment posts) gets buried. Pinterest's audience is planning their wedding, kitchen reno, or vacation — your content needs to fit that mindset.",
    composeUrl: "https://www.pinterest.com/pin-creation-tool/",
    wisdom: [
      { id: "pi-search-not-social", principle: "Pinterest is search, not social. Optimize titles and descriptions like SEO.", attribution: "Pinterest's own Creator Hub", context: "Pinterest's official guidance: write descriptions for what someone would type into the search bar. The platform is functionally a vertical search engine for visual ideas." },
      { id: "pi-vertical", principle: "Vertical 2:3 ratio outperforms square consistently", attribution: "Pinterest Business analytics docs", context: "Pinterest's own data shows pins at a 2:3 ratio (e.g., 1000x1500px) take up more feed real estate, leading to higher save rates." },
    ],
  },
  {
    id: "reddit-sfw",
    name: "Reddit (SFW subs)",
    policy: "suggestive-ok",
    paid: false,
    audience: "Niche communities; subreddit-specific",
    captionStyle: "Title is the caption. Direct, descriptive, sometimes self-deprecating. No hashtags.",
    hashtagNorm: "None. Pick the right subreddit instead.",
    bestFor: "Memes, niche-interest content, OC art, photography",
    whyItWorks: "Reddit's strength is that the audience pre-segments itself into communities — a photo of latte art posted to r/cafe will outperform the same image on Instagram for engaged conversation, even with 1000x less reach.",
    whyToAvoid: "Reddit punishes promotional or 'feed-style' content. If your post reads like an Instagram caption ('living my best life today ✨'), expect downvotes and possibly a ban from the sub.",
    composeUrl: "https://www.reddit.com/submit",
    wisdom: [
      { id: "re-lurk-first", principle: "Lurk before you post. Every sub has its own culture.", attribution: "Reddit veteran consensus", context: "The #1 reason new posters get nuked: they post the same content style across subs without reading the rules or sensing the tone. Spend 10 minutes reading the top posts of the month before posting." },
      { id: "re-title-everything", principle: "The title is everything — Reddit has no caption", attribution: "Reddit posting guides across communities", context: "Unlike Instagram, you can't add a hashtag-laden caption later. Your title is the entire pitch. Top posts almost always have specific, descriptive titles." },
    ],
  },
  {
    id: "reddit-nsfw",
    name: "Reddit (NSFW subs)",
    policy: "explicit-ok",
    paid: false,
    audience: "18+, niche-specific (e.g. r/gonewild, kink-specific subs)",
    captionStyle: "Title is the caption. Often [F]/[M]/[age] tag, playful or descriptive. No hashtags.",
    hashtagNorm: "None. Subreddit choice is everything.",
    bestFor: "Amateur explicit content, kink-specific subs",
    whyItWorks: "Reddit NSFW is the single largest free funnel into paid platforms. Verified accounts on r/gonewild and similar can drive thousands of paid sub conversions per month with no algorithm friction.",
    whyToAvoid: "Each sub has strict verification requirements and posting limits. Get the rules wrong and you're banned across the network — many adult subs share a moderator pool.",
    composeUrl: "https://www.reddit.com/submit",
    wisdom: [
      { id: "rn-verify", principle: "Get verified before posting anywhere serious", attribution: "Adult creator community advice", context: "Verification (a timestamped photo confirming identity) unlocks the largest and best-converting subs. Posting without verification limits you to lower-traffic communities." },
      { id: "rn-niche", principle: "Pick a specific niche sub, not the biggest one", attribution: "Adult creator coaching consensus", context: "A post in a 50K-member kink-specific sub will outperform the same post in r/nsfw (millions of subscribers) for conversion, because the audience is pre-qualified." },
    ],
  },
  {
    id: "x-nsfw",
    name: "X (with sensitive-media flag)",
    policy: "explicit-ok",
    paid: false,
    audience: "18+ followers; creators often funnel to paywalled platforms",
    captionStyle: "Short, teasing, often ending with a link to OF/Fansly. Emojis ok.",
    hashtagNorm: "2-5 niche hashtags for discovery",
    bestFor: "Promo/teaser shots for adult creators, with link to paywall",
    whyItWorks: "X is the primary public funnel for adult creators in 2025+ — one of the few major platforms that allows explicit content with a sensitive-media flag and still allows external links to paid platforms.",
    whyToAvoid: "If you don't flag sensitive media, your account gets restricted fast. And the algorithm shows your posts mostly to people who've engaged with similar content, so growing a fresh account is slow without paid promotion.",
    composeUrl: "https://x.com/compose/post",
    wisdom: [
      { id: "xn-tease", principle: "Tease, don't reveal. The mystery is the funnel.", attribution: "Adult marketing consensus", context: "Posts that show everything kill the click-through to paid platforms. The job of an X post is to make people curious enough to follow the link — not to satisfy them in-feed." },
      { id: "xn-pin", principle: "Pin a free preview to your profile", attribution: "Adult creator coaching guides", context: "New visitors who click your profile from a tagged post should see your best 1-second hook pinned at the top. That pin does more conversion work than any single post." },
    ],
  },
  {
    id: "onlyfans",
    name: "OnlyFans",
    policy: "explicit-ok",
    paid: true,
    audience: "Existing paid subscribers",
    captionStyle: "Personal, intimate, direct address ('hey babe...'). Often includes PPV pricing or DM hook.",
    hashtagNorm: "None inside the platform; matters for cross-promo",
    bestFor: "Full explicit content for paying subscribers",
    whyItWorks: "OnlyFans subscribers pay specifically for parasocial intimacy. A post that addresses them as an individual ('I made this for you') outperforms generic content even if the image quality is identical.",
    whyToAvoid: "Some content categories (extreme kink, certain fetish material) violate OF's stricter ToS — leaning into those on OF instead of Fansly will get accounts terminated with banked earnings frozen.",
    composeUrl: "https://onlyfans.com/my/chats",
    wisdom: [
      { id: "of-parasocial", principle: "Parasocial intimacy is the actual product, not the content", attribution: "Adult-industry agency consensus (ELITE, Centro, etc.)", context: "Subscribers can find explicit content for free everywhere. They pay for the feeling that they have a relationship with you. Caption tone matters more than image quality past a baseline." },
      { id: "of-dms", principle: "DM consistency matters more than feed frequency", attribution: "OnlyFans creator coaching consensus", context: "The top-earning creators spend most of their hours on personalized DMs to existing subs, not creating new feed content. Mass-message tools that feel personal are a huge unlock." },
    ],
  },
  {
    id: "fansly",
    name: "Fansly",
    policy: "explicit-ok",
    paid: true,
    audience: "Paid subscribers; tends to allow kinks OF restricts",
    captionStyle: "Same as OnlyFans — personal, direct address. Can be more kink-specific.",
    hashtagNorm: "None inside platform",
    bestFor: "Explicit content, including categories OF restricts (extreme kink, etc.)",
    whyItWorks: "Fansly is the right home for niches OF has tightened restrictions on. If your content falls into a kink-specific or fetish niche, Fansly typically allows it where OF does not — and you keep the audience that wants it specifically.",
    whyToAvoid: "Fansly's overall traffic is smaller than OF. If your content is mainstream-adult (nothing OF would restrict), you're leaving subscriber volume on the table by being Fansly-primary.",
    composeUrl: "https://fansly.com/posts/new",
    wisdom: [
      { id: "fa-niche", principle: "Lean into the specific niche OF won't host", attribution: "Adult creator migration patterns post-2021 OF policy shifts", context: "Fansly grew specifically because OF tightened rules. Creators who treat Fansly as 'OF lite' underperform — the audience there is searching for the specific content OF made harder to find." },
    ],
  },
  {
    id: "patreon",
    name: "Patreon",
    policy: "suggestive-ok",
    paid: true,
    audience: "Existing fans paying a monthly subscription for ongoing access — typically smaller, deeper-engagement community",
    captionStyle: "Personal, behind-the-scenes voice. Address subscribers like a community ('hey patrons...'). Long-form context is welcome and rewarded.",
    hashtagNorm: "None inside platform; tag-system is separate",
    bestFor: "Behind-the-scenes content, process work, tiered exclusive content (art, music, photography, podcasts, written work). Suggestive content allowed for 18+ creators with the adult-content flag; explicit content is restricted in newer ToS especially for payment processing.",
    whyItWorks: "Patreon's monthly recurring revenue model rewards consistency over virality. A modestly-sized true-fan base ($5-15/mo each) compounds — 500 patrons at $7/mo is $42K/year predictable. Best for creators with a strong existing audience.",
    whyToAvoid: "Patreon discovery is weak. Almost nobody finds you on Patreon — you bring your audience from elsewhere. If you don't have an existing audience to convert, this won't grow on its own. Also: Patreon's explicit content rules have tightened (especially around payment processors), so hard explicit content belongs on OF/Fansly.",
    composeUrl: "https://www.patreon.com/posts/new",
    wisdom: [
      { id: "pa-community", principle: "Community is the product, not the content", attribution: "Jack Conte, Patreon co-founder/CEO", context: "Conte has consistently framed Patreon as paying for the ongoing relationship with a creator, not transactional access to files. The most successful creators on Patreon make patrons feel like collaborators, not customers." },
      { id: "pa-tiers-real-value", principle: "Each tier should have a real, distinct value — not just 'more of the same'", attribution: "Patreon's own creator playbook", context: "Tiers that just differ in 'how much extra content you get' underperform. Top creators design tiers around fundamentally different experiences (e.g., $3 = behind-the-scenes posts, $15 = monthly live Q&A, $50 = signed physical merch)." },
    ],
  },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);
