-- Align canonical CSW delegation columns on profile_wallets with migration-first naming.
-- Runtime code expects canonical_csw_address and related delegation metadata columns.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_wallets'
      AND column_name = 'canonical_zora_csw_address'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_wallets'
      AND column_name = 'canonical_csw_address'
  ) THEN
    ALTER TABLE public.profile_wallets
      RENAME COLUMN canonical_zora_csw_address TO canonical_csw_address;
  END IF;
END
$$;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS chain_id INT NOT NULL DEFAULT 8453;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS canonical_csw_address TEXT NULL;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS canonical_source TEXT NOT NULL DEFAULT 'wallet_sync';

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS privy_embedded_eoa_address TEXT NULL;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS privy_is_owner BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profile_wallets
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NULL;

DROP INDEX IF EXISTS public.profile_wallets_canonical_zora_csw_lc_idx;

CREATE INDEX IF NOT EXISTS profile_wallets_canonical_csw_lc_idx
  ON public.profile_wallets ((LOWER(canonical_csw_address)))
  WHERE canonical_csw_address IS NOT NULL;
