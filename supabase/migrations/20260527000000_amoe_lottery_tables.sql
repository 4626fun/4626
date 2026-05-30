-- Remaining AMOE lottery tables (nonces, entries, daily checkins, burn credits intents).
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/lottery/lotteryAmoe.ts
-- and legacy frontend/db mirrors.
--
-- These complete the authoritative schema for the AMOE lottery flow.

CREATE TABLE IF NOT EXISTS lottery_amoe_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  creator_coin TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS lottery_amoe_nonces_wallet_creator_idx 
  ON lottery_amoe_nonces (wallet_address, creator_coin, expires_at);

CREATE TABLE IF NOT EXISTS lottery_amoe_entries (
  id BIGSERIAL PRIMARY KEY,
  nonce_hash TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  creator_coin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'attested',
  attestation_deadline BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lottery_amoe_daily_twitter_checkins (
  wallet_address TEXT NOT NULL,
  checkin_date DATE NOT NULL,
  tweet_id TEXT,
  tweet_url TEXT,
  tweet_author_username TEXT,
  tweet_author_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, checkin_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS lottery_amoe_daily_twitter_tweet_id_unique
  ON lottery_amoe_daily_twitter_checkins (tweet_id)
  WHERE tweet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lottery_amoe_daily_xmtp_checkins (
  wallet_address TEXT NOT NULL,
  checkin_date DATE NOT NULL,
  message_id TEXT,
  recipient_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, checkin_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS lottery_amoe_daily_xmtp_message_id_unique
  ON lottery_amoe_daily_xmtp_checkins (message_id)
  WHERE message_id IS NOT NULL;

ALTER TABLE lottery_amoe_daily_xmtp_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest" ON lottery_amoe_daily_xmtp_checkins;

CREATE POLICY "deny_public_rest"
ON lottery_amoe_daily_xmtp_checkins
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.amoe_burn_credits_intents (
  signup_id     BIGINT      NOT NULL,
  spend_ref_id  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (signup_id, spend_ref_id)
);

COMMENT ON TABLE lottery_amoe_nonces IS 'AMOE ZK nonce issuance for lottery entries.';
COMMENT ON TABLE lottery_amoe_entries IS 'AMOE lottery entry attestations.';
COMMENT ON TABLE lottery_amoe_daily_twitter_checkins IS 'Daily Twitter AMOE check-ins.';
COMMENT ON TABLE lottery_amoe_daily_xmtp_checkins IS 'Daily XMTP AMOE check-ins.';
COMMENT ON TABLE amoe_burn_credits_intents IS 'Burn credit intents for AMOE phase tracking.';
