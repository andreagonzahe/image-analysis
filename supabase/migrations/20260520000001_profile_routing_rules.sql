-- Creator preferences: explicit content→platform routing rules + price
-- bounds. When set, these OVERRIDE the strategist's defaults.
--
-- Stored as a jsonb blob (single column instead of one column per body
-- category) so adding new categories doesn't require a migration. Shape:
--
--   {
--     "body_routing": {
--       "tease":     "onlyfans_free",
--       "boobs":     "onlyfans_wall",
--       "booty":     "onlyfans_wall",
--       "pussy":     "onlyfans_ppv",
--       "full_nude": "onlyfans_ppv",
--       "modest":    null
--     },
--     "video_destination": "onlyfans_ppv"
--   }
--
-- price_floor_usd / price_ceiling_usd are scalars so we can index/query
-- them easily if needed later. Both null means "no opinion — let the
-- strategist pick freely."

alter table public.profiles
  add column if not exists routing_rules jsonb not null default '{}'::jsonb,
  add column if not exists price_floor_usd integer,
  add column if not exists price_ceiling_usd integer;

-- Reasonable sanity bounds — protects against typos like 50000.
alter table public.profiles drop constraint if exists profiles_price_floor_chk;
alter table public.profiles drop constraint if exists profiles_price_ceiling_chk;
alter table public.profiles
  add constraint profiles_price_floor_chk
    check (price_floor_usd is null or (price_floor_usd >= 0 and price_floor_usd <= 1000)),
  add constraint profiles_price_ceiling_chk
    check (price_ceiling_usd is null or (price_ceiling_usd >= 0 and price_ceiling_usd <= 1000));
