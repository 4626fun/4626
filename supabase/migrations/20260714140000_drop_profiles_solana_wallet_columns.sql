-- Retire profiles.solana_wallet / canonical_solana_wallet / operational_solana_wallet.
-- Solana roles live on profile_wallets (is_canonical_solana_wallet, is_operational_solana_wallet).

BEGIN;

-- Canonical Solana: prefer canonical_solana_wallet, fall back to legacy solana_wallet.
INSERT INTO public.profile_wallets (
  profile_id,
  address,
  chain,
  wallet_type,
  provider,
  is_canonical_solana_wallet,
  verified_at,
  updated_at
)
SELECT
  p.id,
  COALESCE(
    NULLIF(btrim(p.canonical_solana_wallet), ''),
    NULLIF(btrim(p.solana_wallet), '')
  ) AS address,
  'solana',
  'external_eoa',
  'profile_migration',
  true,
  NOW(),
  NOW()
FROM public.profiles p
WHERE COALESCE(
  NULLIF(btrim(p.canonical_solana_wallet), ''),
  NULLIF(btrim(p.solana_wallet), '')
) IS NOT NULL
ON CONFLICT (profile_id, address) DO UPDATE
SET
  chain = CASE
    WHEN btrim(COALESCE(profile_wallets.chain, '')) = '' THEN 'solana'
    ELSE profile_wallets.chain
  END,
  is_canonical_solana_wallet = true,
  verified_at = COALESCE(profile_wallets.verified_at, NOW()),
  updated_at = NOW();

-- Operational Solana (distinct from canonical when both exist).
INSERT INTO public.profile_wallets (
  profile_id,
  address,
  chain,
  wallet_type,
  provider,
  is_operational_solana_wallet,
  verified_at,
  updated_at
)
SELECT
  p.id,
  NULLIF(btrim(p.operational_solana_wallet), '') AS address,
  'solana',
  'embedded_eoa',
  'profile_migration',
  true,
  NOW(),
  NOW()
FROM public.profiles p
WHERE NULLIF(btrim(p.operational_solana_wallet), '') IS NOT NULL
ON CONFLICT (profile_id, address) DO UPDATE
SET
  chain = CASE
    WHEN btrim(COALESCE(profile_wallets.chain, '')) = '' THEN 'solana'
    ELSE profile_wallets.chain
  END,
  is_operational_solana_wallet = true,
  verified_at = COALESCE(profile_wallets.verified_at, NOW()),
  updated_at = NOW();

DROP INDEX IF EXISTS public.profiles_canonical_solana_wallet_idx;
DROP INDEX IF EXISTS public.profiles_operational_solana_wallet_idx;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS solana_wallet,
  DROP COLUMN IF EXISTS canonical_solana_wallet,
  DROP COLUMN IF EXISTS operational_solana_wallet;

COMMENT ON TABLE public.profile_wallets IS
  'Per-profile wallet directory including EVM and Solana role flags (canonical CSW, canonical/operational Solana).';

COMMIT;
