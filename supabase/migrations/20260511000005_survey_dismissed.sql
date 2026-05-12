-- Track whether the user has been asked the onboarding survey, regardless
-- of whether they completed it. If they Skip, we set survey_dismissed_at and
-- don't re-prompt across devices.

alter table public.profiles
  add column if not exists survey_dismissed_at timestamptz;
