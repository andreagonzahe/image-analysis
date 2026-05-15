-- Most successful adult creators run TWO OnlyFans accounts: a free promo
-- account (used as a funnel from social) and a paid subscription account.
-- Fansly creators sometimes do the same. We need to know this so the daily
-- calendar can fill the right number of OF/Fansly slots.
--
-- single        = one account, fill 1 slot per day
-- free_paid_pair = two accounts, fill 2 slots per day (one Free + one Paid)

alter table public.profiles
  add column if not exists of_account_mode text default 'single',
  add column if not exists fansly_account_mode text default 'single';
