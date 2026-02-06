-- Canonical wallet graph + profile provenance foundation.
-- Safe/idempotent where possible; duplicate privy_user_id rows fail fast.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_smart_wallet TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_embedded_eoa TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_fields JSONB NULL;

CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  chain TEXT NOT NULL DEFAULT 'evm',
  wallet_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_wallets (
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_canonical_smart_wallet BOOLEAN NOT NULL DEFAULT false,
  is_embedded_eoa BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, address)
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_canonical
  ON profile_wallets (profile_id)
  WHERE is_canonical_smart_wallet = true;

CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_embedded_eoa
  ON profile_wallets (profile_id)
  WHERE is_embedded_eoa = true;

CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_primary
  ON profile_wallets (profile_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS profile_wallets_address_idx ON profile_wallets (address);
CREATE INDEX IF NOT EXISTS profile_wallets_profile_id_idx ON profile_wallets (profile_id);
CREATE INDEX IF NOT EXISTS wallets_type_idx ON wallets (wallet_type);
CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_idx ON profiles (primary_smart_wallet) WHERE primary_smart_wallet IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM profiles
    WHERE privy_user_id IS NOT NULL
    GROUP BY privy_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_privy_user_id';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_privy_user_id_unique
  ON profiles (privy_user_id)
  WHERE privy_user_id IS NOT NULL;
