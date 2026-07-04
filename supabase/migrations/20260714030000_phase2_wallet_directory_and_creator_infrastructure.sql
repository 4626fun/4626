-- Phase 2 schema consolidation:
-- 1. Rename chat_directory_profiles → wallet_directory (clearer name)
-- 2. Merge creator_agent_wallets + creator_xmtp_agents → creator_infrastructure
-- 3. Recreate v_wallet_directory against wallet_directory

BEGIN;

ALTER TABLE public.chat_directory_profiles RENAME TO wallet_directory;

ALTER INDEX IF EXISTS chat_directory_profiles_score_idx
  RENAME TO wallet_directory_score_idx;

COMMENT ON TABLE public.wallet_directory IS
  'Wallet display/presence cache for chat and directory surfaces (Ethos, XMTP, short-address fallback).';

CREATE TABLE public.creator_infrastructure (
  creator_address TEXT PRIMARY KEY,
  agent_wallet_id TEXT NULL,
  agent_wallet_address TEXT NULL,
  xmtp_agent_address TEXT NULL,
  encrypted_private_key_b64 TEXT NULL,
  encrypted_private_key_iv_b64 TEXT NULL,
  encrypted_private_key_tag_b64 TEXT NULL,
  agent_type TEXT NOT NULL DEFAULT 'eoa',
  privy_wallet_id TEXT NULL,
  csw_address TEXT NULL,
  listed_publicly BOOLEAN NOT NULL DEFAULT TRUE,
  last_processed_message_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_infrastructure_agent_type_check
    CHECK (agent_type IN ('eoa', 'csw'))
);

COMMENT ON TABLE public.creator_infrastructure IS
  'Per-creator automation infrastructure: Privy keeper agent wallet + XMTP agent identity/key material.';

INSERT INTO public.creator_infrastructure (
  creator_address,
  agent_wallet_id,
  agent_wallet_address,
  created_at,
  updated_at
)
SELECT
  lower(caw.coin_address),
  caw.agent_wallet_id,
  lower(caw.agent_wallet_address),
  caw.created_at,
  caw.updated_at
FROM public.creator_agent_wallets caw;

INSERT INTO public.creator_infrastructure (
  creator_address,
  xmtp_agent_address,
  encrypted_private_key_b64,
  encrypted_private_key_iv_b64,
  encrypted_private_key_tag_b64,
  agent_type,
  privy_wallet_id,
  csw_address,
  listed_publicly,
  last_processed_message_at,
  created_at,
  updated_at
)
SELECT
  lower(cxa.creator_address),
  lower(cxa.xmtp_agent_address),
  cxa.encrypted_private_key_b64,
  cxa.encrypted_private_key_iv_b64,
  cxa.encrypted_private_key_tag_b64,
  COALESCE(NULLIF(btrim(cxa.agent_type), ''), 'eoa'),
  NULLIF(btrim(cxa.privy_wallet_id), ''),
  CASE
    WHEN cxa.csw_address IS NOT NULL AND btrim(cxa.csw_address) <> ''
      THEN lower(cxa.csw_address)
    ELSE NULL
  END,
  COALESCE(cxa.listed_publicly, TRUE),
  cxa.last_processed_message_at,
  cxa.created_at,
  cxa.updated_at
FROM public.creator_xmtp_agents cxa
ON CONFLICT (creator_address) DO UPDATE SET
  xmtp_agent_address = EXCLUDED.xmtp_agent_address,
  encrypted_private_key_b64 = EXCLUDED.encrypted_private_key_b64,
  encrypted_private_key_iv_b64 = EXCLUDED.encrypted_private_key_iv_b64,
  encrypted_private_key_tag_b64 = EXCLUDED.encrypted_private_key_tag_b64,
  agent_type = EXCLUDED.agent_type,
  privy_wallet_id = EXCLUDED.privy_wallet_id,
  csw_address = EXCLUDED.csw_address,
  listed_publicly = EXCLUDED.listed_publicly,
  last_processed_message_at = EXCLUDED.last_processed_message_at,
  updated_at = GREATEST(creator_infrastructure.updated_at, EXCLUDED.updated_at);

CREATE INDEX IF NOT EXISTS creator_infrastructure_listed_idx
  ON public.creator_infrastructure (listed_publicly, created_at DESC)
  WHERE xmtp_agent_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_infrastructure_updated_idx
  ON public.creator_infrastructure (updated_at DESC);

ALTER TABLE public.creator_infrastructure ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_infrastructure'
      AND policyname = 'creator_infrastructure_deny_all'
  ) THEN
    CREATE POLICY creator_infrastructure_deny_all
      ON public.creator_infrastructure
      FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

DROP TABLE IF EXISTS public.creator_agent_wallets CASCADE;
DROP TABLE IF EXISTS public.creator_xmtp_agents CASCADE;

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
      NULLIF(btrim(p.primary_smart_wallet), ''),
      NULLIF(btrim(p.primary_wallet), '')
    )
  ) = w.canonical_wallet;

COMMENT ON VIEW public.v_wallet_directory IS
  'Unified wallet display directory: wallet_directory enriched with profiles when the wallet maps to a 4626 account.';

COMMIT;
