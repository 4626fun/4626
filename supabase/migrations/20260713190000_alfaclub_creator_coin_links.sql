-- Immutable, non-custodial Creator Coin claims for AlfaClub rooms.
-- Linking proves existing authority without changing coin ownership or payout routing.

CREATE TABLE IF NOT EXISTS alfaclub.creator_coin_links (
  room_id                    TEXT PRIMARY KEY,
  token_id                   TEXT NOT NULL,
  creator_coin_address       TEXT NOT NULL UNIQUE,
  profile_id                 BIGINT NOT NULL REFERENCES public.profiles(id),
  execution_address          TEXT NOT NULL,
  verified_signer_address    TEXT,
  verification_method        TEXT NOT NULL,
  verification_block         NUMERIC(78, 0) NOT NULL,
  coin_name                   TEXT NOT NULL,
  coin_symbol                 TEXT NOT NULL,
  coin_decimals               INTEGER NOT NULL,
  owner_snapshot              JSONB NOT NULL,
  creator_coin_payout_recipient TEXT NOT NULL,
  policy_controller_address   TEXT,
  verification_metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_coin_links_method_check
    CHECK (verification_method IN ('direct_owner', 'policy_controller')),
  CONSTRAINT creator_coin_links_decimals_check
    CHECK (coin_decimals BETWEEN 0 AND 255),
  CONSTRAINT creator_coin_links_token_id_check
    CHECK (token_id ~ '^[0-9]+$'),
  CONSTRAINT creator_coin_links_coin_address_check
    CHECK (creator_coin_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT creator_coin_links_execution_address_check
    CHECK (execution_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT creator_coin_links_signer_address_check
    CHECK (verified_signer_address IS NULL OR verified_signer_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT creator_coin_links_payout_address_check
    CHECK (creator_coin_payout_recipient ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT creator_coin_links_controller_address_check
    CHECK (policy_controller_address IS NULL OR policy_controller_address ~ '^0x[0-9a-f]{40}$')
);

CREATE INDEX IF NOT EXISTS creator_coin_links_profile_idx
  ON alfaclub.creator_coin_links(profile_id, created_at DESC);

ALTER TABLE alfaclub.creator_coin_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'creator_coin_links'
      AND policyname = 'creator_coin_links_deny_all'
  ) THEN
    CREATE POLICY creator_coin_links_deny_all
      ON alfaclub.creator_coin_links FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS alfaclub.creator_coin_link_challenges (
  nonce_hash             TEXT PRIMARY KEY,
  profile_id             BIGINT NOT NULL REFERENCES public.profiles(id),
  room_id                TEXT NOT NULL,
  token_id               TEXT NOT NULL,
  creator_coin_address   TEXT NOT NULL,
  execution_address      TEXT NOT NULL,
  expires_at             TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_coin_link_challenges_nonce_hash_check
    CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT creator_coin_link_challenges_token_id_check
    CHECK (token_id ~ '^[0-9]+$'),
  CONSTRAINT creator_coin_link_challenges_coin_address_check
    CHECK (creator_coin_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT creator_coin_link_challenges_execution_address_check
    CHECK (execution_address ~ '^0x[0-9a-f]{40}$')
);

CREATE INDEX IF NOT EXISTS creator_coin_link_challenges_expiry_idx
  ON alfaclub.creator_coin_link_challenges(expires_at);

ALTER TABLE alfaclub.creator_coin_link_challenges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'creator_coin_link_challenges'
      AND policyname = 'creator_coin_link_challenges_deny_all'
  ) THEN
    CREATE POLICY creator_coin_link_challenges_deny_all
      ON alfaclub.creator_coin_link_challenges FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE alfaclub.creator_coin_links IS
  'Immutable AlfaClub room-to-Creator-Coin claims proven by read-only authority checks and wallet signature.';

COMMENT ON TABLE alfaclub.creator_coin_link_challenges IS
  'Short-lived, single-use wallet challenges for AlfaClub Creator Coin linking.';
