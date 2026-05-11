# Postwise — Auth + Cloud Vault Setup

The app works without auth (vault stays browser-local).
Adding Clerk + Supabase enables sign-in and cross-device sync of the analysis
metadata. **Images stay on the device where they were uploaded** — only the
text JSON (platform, caption, price, tags, strategy) is synced.

## 1. Clerk (authentication)

1. Sign up at https://clerk.com and create an Application.
2. In **Configure → API keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
3. Paste them into `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
CLERK_SECRET_KEY=sk_test_xxx...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

That's it. Restart `npm run dev`. You'll see a **Sign in** button in the nav.
Without these env vars, the nav has no sign-in button and the app runs in
local-only mode.

## 2. Supabase (cloud vault — optional but recommended)

1. Sign up at https://supabase.com and create a Project (the free tier is
   plenty for a single creator).
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (treat like a
     password — never put in client code)
3. Paste into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

4. Open the Supabase SQL editor and run the schema below. It creates the
   `posts` table with the right shape and a useful index. We don't enable RLS
   because all access is gated by the server-side API using the service-role
   key plus Clerk auth checks.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  analysis jsonb not null,
  content_rating text not null,
  primary_platform text not null,
  primary_price_low int not null default -1,
  primary_price_high int not null default -1
);

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);
```

5. Restart `npm run dev`. Sign in. Drop an image. Save to vault. Open
   `/vault` from a different browser, sign in with the same account — the card
   appears with an *"Image is on another device"* placeholder.

## How sync works

- **Save to vault** writes the image blob + thumbnail to IndexedDB (local) and
  also POSTs the JSON to `/api/vault/sync`. The server uses Clerk to identify
  the user and Supabase to persist the metadata under that user_id.
- **Vault page** loads local + remote posts, dedupes by id, and merges them.
  Cards from remote-only sources show a placeholder where the image would be.
- **Delete** removes from IndexedDB and (best-effort) from Supabase.
- **Backfill**: if you have local posts created before signing in, the vault
  page shows a "Sync N posts" banner that uploads them all to your account.

## How to revert

Delete the Clerk and Supabase env vars from `.env.local` and restart. The
app instantly falls back to browser-local mode. Existing local data is
untouched.
