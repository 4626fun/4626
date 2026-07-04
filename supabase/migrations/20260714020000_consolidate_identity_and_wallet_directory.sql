-- Phase 1 identity consolidation:
-- 1. Merge public.accounts into public.profiles (email_verified)
-- 2. Repoint account_* child FKs to profiles.privy_user_id
-- 3. Add v_wallet_directory read model (profiles + chat_directory_profiles)
-- 4. Migrate creator_wallets → allowlist and drop creator_wallets

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles p
SET
  email_verified = p.email_verified OR COALESCE(a.email_verified, false),
  updated_at = NOW()
FROM public.accounts a
WHERE p.privy_user_id = a.privy_user_id;

UPDATE public.profiles p
SET
  email = a.email,
  updated_at = NOW()
FROM public.accounts a
WHERE p.privy_user_id = a.privy_user_id
  AND (p.email IS NULL OR btrim(p.email) = '')
  AND a.email IS NOT NULL
  AND btrim(a.email) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE lower(other.email) = lower(a.email)
      AND other.id <> p.id
  );

INSERT INTO public.profiles (privy_user_id, email, email_verified, created_at, updated_at)
SELECT
  a.privy_user_id,
  a.email,
  COALESCE(a.email_verified, false),
  COALESCE(a.created_at, NOW()),
  COALESCE(a.updated_at, NOW())
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.privy_user_id = a.privy_user_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE a.email IS NOT NULL
    AND btrim(a.email) <> ''
    AND lower(p.email) = lower(a.email)
);

UPDATE public.profiles p
SET
  privy_user_id = COALESCE(p.privy_user_id, a.privy_user_id),
  email_verified = p.email_verified OR COALESCE(a.email_verified, false),
  updated_at = NOW()
FROM public.accounts a
WHERE p.privy_user_id IS NULL
  AND a.email IS NOT NULL
  AND btrim(a.email) <> ''
  AND lower(p.email) = lower(a.email)
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE other.privy_user_id = a.privy_user_id
      AND other.id <> p.id
  );

ALTER TABLE public.account_linked_methods
  DROP CONSTRAINT IF EXISTS account_linked_methods_privy_user_id_fkey;

ALTER TABLE public.account_zora_signals
  DROP CONSTRAINT IF EXISTS account_zora_signals_privy_user_id_fkey;

DROP INDEX IF EXISTS public.profiles_privy_user_id_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_privy_user_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_privy_user_id_key UNIQUE (privy_user_id);
  END IF;
END
$$;

ALTER TABLE public.account_linked_methods
  ADD CONSTRAINT account_linked_methods_privy_user_id_fkey
  FOREIGN KEY (privy_user_id)
  REFERENCES public.profiles (privy_user_id)
  ON DELETE CASCADE;

ALTER TABLE public.account_zora_signals
  ADD CONSTRAINT account_zora_signals_privy_user_id_fkey
  FOREIGN KEY (privy_user_id)
  REFERENCES public.profiles (privy_user_id)
  ON DELETE CASCADE;

DROP TABLE IF EXISTS public.accounts CASCADE;

INSERT INTO public.allowlist (address, approved_by, note)
SELECT
  lower(cw.wallet_address),
  'migration:creator_wallets',
  'Migrated from creator_wallets (coin=' || lower(cw.coin_address) || ', role=' || cw.wallet_role || ')'
FROM public.creator_wallets cw
WHERE cw.wallet_address IS NOT NULL
  AND btrim(cw.wallet_address) <> ''
ON CONFLICT (address) DO NOTHING;

DROP TABLE IF EXISTS public.creator_wallets CASCADE;

CREATE OR REPLACE VIEW public.v_wallet_directory AS
SELECT
  c.canonical_wallet,
  COALESCE(NULLIF(btrim(p.display_name), ''), c.display_name) AS display_name,
  COALESCE(NULLIF(btrim(p.avatar_url), ''), c.avatar_url) AS avatar_url,
  c.xmtp_address,
  c.xmtp_inbox_id,
  c.ethos_score,
  c.ethos_level,
  c.ethos_userkey,
  c.ethos_profile_id,
  c.ethos_score_updated_at,
  c.last_seen_at,
  c.created_at AS directory_created_at,
  c.updated_at AS directory_updated_at,
  p.id AS profile_id,
  p.privy_user_id
FROM public.chat_directory_profiles c
LEFT JOIN public.profiles p
  ON p.merged_into_profile_id IS NULL
  AND lower(
    COALESCE(
      NULLIF(btrim(p.csw_address), ''),
      NULLIF(btrim(p.primary_smart_wallet), ''),
      NULLIF(btrim(p.primary_wallet), '')
    )
  ) = c.canonical_wallet;

COMMENT ON VIEW public.v_wallet_directory IS
  'Unified wallet display directory: chat_directory_profiles enriched with profiles when the wallet maps to a 4626 account.';

COMMIT;
