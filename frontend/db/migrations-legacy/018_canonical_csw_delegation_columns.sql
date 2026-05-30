-- Phase 8: canonical Coinbase Smart Wallet + delegated Privy embedded EOA tracking.

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

-- Backfill canonical CSW onto canonical smart-wallet rows when available.
UPDATE public.profile_wallets
SET canonical_csw_address = LOWER(address)
WHERE canonical_csw_address IS NULL
  AND is_canonical_smart_wallet = true
  AND address ~* '^0x[0-9a-f]{40}$';

-- Backfill delegated embedded EOA from legacy profile columns for canonical rows.
UPDATE public.profile_wallets pw
SET privy_embedded_eoa_address = COALESCE(
  pw.privy_embedded_eoa_address,
  CASE
    WHEN p.primary_embedded_eoa ~* '^0x[0-9a-f]{40}$' THEN LOWER(p.primary_embedded_eoa)
    ELSE NULL
  END,
  CASE
    WHEN p.embedded_wallet ~* '^0x[0-9a-f]{40}$' THEN LOWER(p.embedded_wallet)
    ELSE NULL
  END
)
FROM public.profiles p
WHERE p.id = pw.profile_id
  AND pw.is_canonical_smart_wallet = true
  AND pw.privy_embedded_eoa_address IS NULL;

CREATE INDEX IF NOT EXISTS profile_wallets_profile_chain_idx
  ON public.profile_wallets (profile_id, chain_id);

CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_profile_chain_canonical_unique
  ON public.profile_wallets (profile_id, chain_id)
  WHERE is_canonical_smart_wallet = true;

CREATE INDEX IF NOT EXISTS profile_wallets_canonical_csw_lc_idx
  ON public.profile_wallets ((LOWER(canonical_csw_address)))
  WHERE canonical_csw_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS profile_wallets_privy_embedded_eoa_lc_idx
  ON public.profile_wallets ((LOWER(privy_embedded_eoa_address)))
  WHERE privy_embedded_eoa_address IS NOT NULL;
