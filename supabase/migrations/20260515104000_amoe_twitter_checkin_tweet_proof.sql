-- Migration: enforce strict tweet-proof metadata for AMOE Twitter check-ins.
--
-- Keep in sync with:
--   frontend/db/migrations/042_amoe_twitter_checkin_tweet_proof.sql

ALTER TABLE public.lottery_amoe_daily_twitter_checkins
  ADD COLUMN IF NOT EXISTS tweet_id TEXT,
  ADD COLUMN IF NOT EXISTS tweet_url TEXT,
  ADD COLUMN IF NOT EXISTS tweet_author_username TEXT,
  ADD COLUMN IF NOT EXISTS tweet_author_id TEXT;

-- Prevent replaying the same tweet across wallets/days while allowing
-- historical null rows from pre-proof mode.
CREATE UNIQUE INDEX IF NOT EXISTS lottery_amoe_daily_twitter_tweet_id_unique
  ON public.lottery_amoe_daily_twitter_checkins (tweet_id)
  WHERE tweet_id IS NOT NULL;
