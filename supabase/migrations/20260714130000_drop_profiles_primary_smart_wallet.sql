-- Retire profiles.primary_smart_wallet — csw_address is the sole canonical CSW column.

BEGIN;

UPDATE public.profiles
SET csw_address = primary_smart_wallet
WHERE (csw_address IS NULL OR btrim(csw_address) = '')
  AND primary_smart_wallet IS NOT NULL
  AND btrim(primary_smart_wallet) <> '';

CREATE OR REPLACE VIEW public.v_wallet_directory AS
SELECT
  w.canonical_wallet,
  COALESCE(NULLIF(btrim(p.display_name), ''), w.display_name) AS display_name,
  COALESCE(NULLIF(btrim(p.avatar_url), ''), w.avatar_url) AS avatar_url,
  w.xmtp_address,
  w.xmtp_inbox_id,
  w.ethos_score,
  w.ethos_level,
  w.ethos_userkey,
  w.ethos_profile_id,
  w.ethos_score_updated_at,
  w.last_seen_at,
  w.created_at AS directory_created_at,
  w.updated_at AS directory_updated_at,
  p.id AS profile_id,
  p.privy_user_id
FROM public.wallet_directory w
LEFT JOIN public.profiles p
  ON p.merged_into_profile_id IS NULL
  AND lower(
    COALESCE(
      NULLIF(btrim(p.csw_address), ''),
      NULLIF(btrim(p.primary_wallet), '')
    )
  ) = w.canonical_wallet;

DROP INDEX IF EXISTS public.profiles_primary_smart_wallet_lc_idx;
DROP INDEX IF EXISTS public.profiles_primary_smart_wallet_idx;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS primary_smart_wallet;

COMMENT ON COLUMN public.profiles.csw_address IS
  'Canonical parent Coinbase Smart Wallet (identity, custody, canonical4337 sender).';

COMMIT;
