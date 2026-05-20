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
    captionStyle: "1-3 sentences (medium-to-short), warm and personal, can include a CTA. Emojis welcome. Instagram is a VISUAL-FIRST platform — image quality drives reach far more than caption length.",
    hashtagNorm: "5-15 hashtags, mix of broad and niche",
    bestFor: "Highest-quality, most aesthetic images go here. Lifestyle, fashion, travel, portraits (clothed). Save your strongest visuals for IG — it's the platform with the highest visual-quality bar and the longest content half-life.",
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
    captionStyle: "Short, punchy, trend-referencing. Lowercase often. Hook in first 5 words. The CONTENT must be a short day-in-the-life-style VIDEO — quick clips with text overlay, GRWM, behind-the-scenes, mini-vlogs. A still image is almost never the answer.",
    hashtagNorm: "3-5 trending hashtags",
    bestFor: "VIDEO content. A still image is almost never a primary recommendation for TikTok — only consider it for memes, screenshot reactions, or photo-carousels with a clear hook. For any video file (mp4/mov), TikTok is a strong primary candidate.",
    whyItWorks: "TikTok's For You algorithm rewards retention on VIDEO. The platform is fundamentally a short-video network — your routing should reflect that. For static images, almost any other platform (Instagram, Pinterest, X) is a better fit.",
    whyToAvoid: "Do NOT recommend TikTok as primary for a still image unless it's a meme/reaction with viral context. TikTok's automated moderation is also the strictest of any major platform — even cleavage in swimwear gets demoted. Strikes accumulate fast and accounts get age-restricted with no appeal.",
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
    captionStyle: "TEXT-DRIVEN: caption does the heavy lifting, image is the hook. Short, sharp, very spicy/edgy for adult-creator accounts. Lowercase ok. Confident, opinionated. Short looping videos (4-30s) also perform well — sometimes better than stills.",
    hashtagNorm: "0-2 hashtags max",
    bestFor: "Text-first spicy content, short videos, memes, news takes, suggestive-but-not-explicit stills. The caption IS the post; the image hooks people into reading it.",
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
    captionStyle: "Like X but a touch less aggressive. Text-driven, personality-first, conversational. Content warnings (labels) are normal and respected. Treat it as a sister-channel to X with slightly softer tone.",
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
    captionStyle: "SHORT title-as-caption — 5-12 words max, playful or descriptive, often with [F]/[M]/[age] tag. No hashtags. Reddit titles are the whole hook; redditors skim, they don't read paragraphs.",
    hashtagNorm: "None. Subreddit choice is everything.",
    bestFor: "Spicy/suggestive content (lingerie, swimwear, lightly suggestive nudity) — provocative but NOT the fully-explicit reveal. Save the explicit for paid platforms; Reddit is a TEASER funnel where 'almost' beats 'too much'.",
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
  // OnlyFans is split into THREE distinct destinations because each has a
  // completely different content rule, audience, and revenue role:
  //
  //   onlyfans_free  — the free/promo OF account (anyone can subscribe
  //                    at $0). Lead-magnet feed; lives at the top of the
  //                    funnel. Tier 1-2 only — basically X-NSFW-style
  //                    teaser content with a CTA to the paid account.
  //
  //   onlyfans_wall  — the paid account's feed (subscribers see this for
  //                    free as part of their monthly sub). Loyalty
  //                    content. Tier 2-3 max — lingerie, topless
  //                    artistic, suggestive sets. Putting tier 4-5 here
  //                    gives subs the climax for free and tanks PPV
  //                    revenue.
  //
  //   onlyfans_ppv   — pay-per-view DMs to existing subs. Each unlock is
  //                    priced individually ($10-100+). Tier 3-5 nudity
  //                    and explicit content lives here exclusively. The
  //                    revenue driver.
  //
  // The legacy id `onlyfans` (kept as the next entry) maps to onlyfans_wall
  // for display, so existing vault posts still render correctly.
  {
    id: "onlyfans_free",
    name: "OnlyFans · Free page",
    policy: "no-nudity",
    paid: false,
    audience: "Anyone — free promo account at the top of the funnel",
    captionStyle: "Teaser-y, hook-driven. Hint at what's on the paid account. Mention the upgrade link in the bio.",
    hashtagNorm: "Light — the audience already found you. Bio link does the conversion work, not hashtags.",
    bestFor: "Tier 1-2 only. Suggestive but never nude — lingerie or swimwear with a strong tease frame, behind-the-scenes lifestyle, full-clothed previews. Every post should make the viewer want to upgrade to the paid account for more.",
    whyItWorks: "A free OF is the highest-converting funnel because the audience is one tap from subscribing. Unlike Instagram or X where they leave to find your paid account, the upgrade happens inside OF. Treat this like a landing page, not a content destination.",
    whyToAvoid: "Posting actual nudity here defeats the whole point — there's no reason to upgrade if the free account already shows everything. Also keeps you within OF's looser policy for non-explicit accounts.",
    composeUrl: "https://onlyfans.com/posts/new",
    wisdom: [
      { id: "off-funnel", principle: "Free OF is a landing page, not a content destination", attribution: "Adult-funnel coaching consensus", context: "The conversion ratio from free OF to paid OF (in-platform tap) is wildly higher than from external social. Most top earners run a strict 2-account model — free is for hooks, paid is for content." },
    ],
  },
  {
    id: "onlyfans_wall",
    name: "OnlyFans · Paid wall",
    policy: "suggestive-ok",
    paid: true,
    audience: "Existing paid subscribers reading their main feed",
    captionStyle: "Personal, intimate, direct address ('hey babe...'). Treats the reader as a single individual, not a crowd.",
    hashtagNorm: "None inside the platform.",
    bestFor: "Tier 2-3 max. Loyalty content for paying subs — lingerie sets, topless artistic, full-clothed teasers from a paid shoot. The wall is for FOMO and retention; it makes subs feel they're getting consistent value so they don't churn.",
    whyItWorks: "Subscribers paid for parasocial intimacy. The wall is where that promise gets delivered — a steady drip of content that addresses them like a single person. Two-three wall posts a week beats one weekly polished post for retention.",
    whyToAvoid: "Posting Tier 4-5 nudity on the wall gives existing subs the climax for free. They'll keep their sub but never unlock a PPV. Save explicit content for onlyfans_ppv.",
    composeUrl: "https://onlyfans.com/posts/new",
    wisdom: [
      { id: "ofw-parasocial", principle: "Parasocial intimacy is the actual product, not the content", attribution: "Adult-industry agency consensus", context: "Subscribers can find explicit content for free everywhere. They pay for the feeling of a relationship. Caption tone matters more than image quality past a baseline." },
      { id: "ofw-retention", principle: "Wall content is retention, not revenue", attribution: "OnlyFans creator coaching", context: "The wall's job is to keep subs from churning, not to convert them to a higher tier. The revenue uplift comes from PPV. Use the wall to keep them happy enough to stay subscribed." },
    ],
  },
  {
    id: "onlyfans_ppv",
    name: "OnlyFans · PPV (DMs)",
    policy: "explicit-ok",
    paid: true,
    audience: "Paid subscribers receiving locked PPV in their DMs",
    captionStyle: "DM-style sales message. Personal hook + concrete tease + clear unlock price. 'Just made you something special for $X — full set, my best one yet 💋'",
    hashtagNorm: "None.",
    bestFor: "Tier 3-5 explicit content. Topless artistic ($8-18), nude boudoir ($12-22), explicit solo ($15-30), partnered ($30-60). Every unlock is priced individually. This is the revenue driver — the wall builds the relationship, PPV captures the spend.",
    whyItWorks: "Subscribers will pay $15-50 for a single piece of content if they feel it was made specifically for them and they can't see it on the wall. Mass-DM tools let you sell to your entire audience while keeping the message feeling 1-1.",
    whyToAvoid: "Don't put your most explicit content on the wall and then try to also sell it as PPV — once subs see it free, they won't pay to unlock. Pick ONE destination per shot.",
    composeUrl: "https://onlyfans.com/my/chats",
    wisdom: [
      { id: "ofppv-dms", principle: "DM consistency drives more revenue than feed frequency", attribution: "OnlyFans creator coaching consensus", context: "The top-earning creators spend most of their hours on PPV mass-DMs to existing subs, not creating new feed content. The 1-1-feeling DM is where the money lives." },
      { id: "ofppv-escalation", principle: "Always plan a drop-price escalation", attribution: "Adult mass-DM playbooks", context: "Send the initial PPV at full price. 24h later, drop it 30-50% and re-send only to non-unlockers. This squeezes ~2x revenue out of the same content versus a single-price send." },
    ],
  },

  // DEPRECATED legacy id. Existing vault posts created before the OF
  // split was introduced still carry `primary_platform: "onlyfans"`.
  // We keep this entry so those posts continue to render with a sensible
  // label. New strategist runs use onlyfans_free / onlyfans_wall /
  // onlyfans_ppv instead.
  {
    id: "onlyfans",
    name: "OnlyFans (legacy)",
    policy: "explicit-ok",
    paid: true,
    audience: "Legacy OF entry — re-analyze the post to map it to free / wall / PPV.",
    captionStyle: "—",
    hashtagNorm: "—",
    bestFor: "This post was analyzed before OnlyFans was split into three destinations (free promo / paid wall / PPV DMs). Re-analyze to get a specific routing.",
    whyItWorks: "—",
    whyToAvoid: "—",
    composeUrl: "https://onlyfans.com/my/chats",
    wisdom: [],
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
    id: "snapchat",
    name: "Snapchat (public)",
    policy: "no-nudity",
    paid: false,
    audience: "Existing followers from your Story / Spotlight network. Younger-skewing, casual.",
    captionStyle: "Casual, in-the-moment, like a text to a friend. Stickers and overlay text encouraged. No hashtags.",
    hashtagNorm: "None.",
    bestFor: "Day-in-the-life Stories, behind-the-scenes, lifestyle, fully-clothed teasers pointing to Premium Snap / OF",
    whyItWorks: "Snap Stories disappear in 24h, which means the audience expects raw and frequent, not polished. Adult creators use it as a parasocial-builder before pushing to paid subscriptions.",
    whyToAvoid: "Snap's automated moderation rejects anything explicit and can permanently ban accounts. Spotlight (the public feed) is even stricter. Anything beyond fully clothed belongs on Premium Snap or OF.",
    composeUrl: "https://web.snapchat.com/",
    wisdom: [
      { id: "sn-cadence", principle: "Daily Stories beat occasional masterpieces", attribution: "Snapchat creator coaching consensus", context: "Snap's algorithm rewards consistent daily posting. Three lifestyle Stories a day outperform one polished weekly post by a huge margin. The platform punishes silence." },
      { id: "sn-funnel", principle: "Public Snap exists to drive paid Snap subs", attribution: "Adult-industry funnel playbooks", context: "Almost no creator monetizes public Snap directly. Its job is to keep your fans warm with free daily access so they upgrade to your Premium Snap or OF. Treat it as the top of the funnel." },
    ],
  },
  {
    id: "snapchat-premium",
    name: "Premium Snapchat",
    policy: "explicit-ok",
    paid: true,
    audience: "Paying subscribers (typically $10-30/month flat) who get access to a private Snap account with explicit content",
    captionStyle: "Direct, intimate, DM-style. 'Hey babe...'. Snap-native — short, raw, frequent.",
    hashtagNorm: "None.",
    bestFor: "Explicit photo and short-video drip content, daily personalized Snaps, custom requests over DM",
    whyItWorks: "Premium Snap monetizes a different psychology than OF: subscribers pay for the FEELING of having an intimate Snap friend, not for content quantity. Lower friction to start (no platform cut), simple flat-rate billing.",
    whyToAvoid: "Not a real platform feature — it's a workaround using a private Snap account. Payment collection is off-platform (Cash App / OF / etc.) which means chargebacks and account loss risk are higher. Snapchat will ban Premium Snap accounts they catch.",
    composeUrl: "https://web.snapchat.com/",
    wisdom: [
      { id: "psn-flat-rate", principle: "Charge a flat monthly rate, not per-content", attribution: "Premium Snap creator consensus", context: "Premium Snap subscribers expect unlimited access for one fixed price. Trying to PPV individual snaps churns them fast. The pricing model is closer to a $15/mo private Patreon than per-piece sales." },
      { id: "psn-dm-priority", principle: "Subs pay for the DMs more than the feed", attribution: "Adult creator playbooks across platforms", context: "On Premium Snap especially, the perceived value is personal DM access. Posts to the feed are a baseline; the 1-1 chat is the product. Top creators set aside dedicated reply windows daily." },
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
    bestFor: "ARTISTIC content above all — boudoir, fine-art nudes, photography sets with craft and intent. Both clothed and tasteful nude work fits here (with the adult-content flag enabled and within current ToS). The differentiator vs OF is FRAMING: Patreon patrons pay for art and craft, not paywall titillation. Pair each post with a craft note ('shot on 35mm, golden hour, third roll', 'concept: solitude as power') and patrons stay for years. NOT for hardcore explicit — that belongs on OF/Fansly.",
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

/**
 * Map a legacy "onlyfans" id (with optional distribution_mode hint) to
 * one of the three new specific OF destinations. Used when displaying
 * vault posts that were analyzed before the OF split landed.
 *
 *   onlyfans + dm-mode "ppv"   → onlyfans_ppv
 *   onlyfans + dm-mode "wall"  → onlyfans_wall
 *   onlyfans + dm-mode "both"  → onlyfans_wall (the visible part)
 *   onlyfans + null/unknown    → onlyfans_wall (most common default)
 *
 * Anything that isn't legacy "onlyfans" passes through unchanged.
 */
export function normalizeOnlyFansId(
  platformId: string,
  distributionMode?: "wall" | "ppv" | "both" | null
): string {
  if (platformId !== "onlyfans") return platformId;
  if (distributionMode === "ppv") return "onlyfans_ppv";
  return "onlyfans_wall"; // wall, both, null → wall as default
}

/** All three OnlyFans destination ids. Useful for "is this any OF tier?" checks. */
export const ONLYFANS_PLATFORM_IDS = ["onlyfans_free", "onlyfans_wall", "onlyfans_ppv"] as const;

/**
 * Returns true if the platform is one of the three OF destinations OR
 * the legacy `onlyfans` id (so callers can still match all OF posts
 * regardless of when they were analyzed).
 */
export function isOnlyFansPlatform(platformId: string): boolean {
  return platformId === "onlyfans" || ONLYFANS_PLATFORM_IDS.includes(platformId as typeof ONLYFANS_PLATFORM_IDS[number]);
}
