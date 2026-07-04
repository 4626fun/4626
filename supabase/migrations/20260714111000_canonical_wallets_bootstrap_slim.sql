-- Slim bootstrap for profile_wallets after public.wallets retirement.
-- Replaces the wallets + profile_wallets pair in 20260402100000_migrate_waitlist_keepr_runtime_schema.sql.

CREATE TABLE IF NOT EXISTS public.profile_wallets (
  profile_id BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_canonical_smart_wallet BOOLEAN NOT NULL DEFAULT false,
  is_embedded_eoa BOOLEAN NOT NULL DEFAULT false,
  is_canonical_solana_wallet BOOLEAN NOT NULL DEFAULT false,
  is_operational_solana_wallet BOOLEAN NOT NULL DEFAULT false,
  chain_id INT NOT NULL DEFAULT 8453,
  canonical_zora_csw_address TEXT NULL,
  canonical_source TEXT NOT NULL DEFAULT 'zora_readonly',
  privy_embedded_eoa_address TEXT NULL,
  privy_is_owner BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ NULL,
  verified_at TIMESTAMPTZ,
  metadata JSONB,
  chain TEXT NOT NULL DEFAULT 'evm',
  wallet_type TEXT NOT NULL DEFAULT 'unknown',
  provider TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, address)
);

ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS is_canonical_solana_wallet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS is_operational_solana_wallet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS chain_id INT NOT NULL DEFAULT 8453;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS canonical_zora_csw_address TEXT NULL;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS canonical_source TEXT NOT NULL DEFAULT 'zora_readonly';
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS privy_embedded_eoa_address TEXT NULL;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS privy_is_owner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NULL;
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'evm';
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE public.profile_wallets ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'unknown';

CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_canonical
  ON public.profile_wallets (profile_id)
  WHERE is_canonical_smart_wallet = true;
CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_embedded_eoa
  ON public.profile_wallets (profile_id)
  WHERE is_embedded_eoa = true;
CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_canonical_solana
  ON public.profile_wallets (profile_id)
  WHERE is_canonical_solana_wallet = true;
CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_operational_solana
  ON public.profile_wallets (profile_id)
  WHERE is_operational_solana_wallet = true;
CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_primary
  ON public.profile_wallets (profile_id)
  WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS profile_wallets_address_idx
  ON public.profile_wallets (address);
