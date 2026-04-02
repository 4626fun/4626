-- Migration-first baseline for waitlist + keepr schema.
-- Mirrors runtime bootstrap DDL so server handlers can fast-path without mutating schema on cold starts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Waitlist profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  primary_wallet TEXT NULL,
  solana_wallet TEXT NULL,
  privy_user_id TEXT NULL,
  embedded_wallet TEXT NULL,
  embedded_wallet_chain TEXT NULL,
  embedded_wallet_client_type TEXT NULL,
  base_sub_account TEXT NULL,
  persona TEXT NULL,
  has_creator_coin BOOLEAN NULL,
  contact_preference TEXT NULL,
  border_tier INT NOT NULL DEFAULT 0,
  x_follow_verified_at TIMESTAMPTZ NULL,
  app_access_status TEXT NOT NULL DEFAULT 'pending',
  app_access_decision_note TEXT NULL,
  app_access_decided_at TIMESTAMPTZ NULL,
  app_access_decided_by TEXT NULL,
  verifications JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS persona TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_creator_coin BOOLEAN NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privy_user_id TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS embedded_wallet TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS embedded_wallet_chain TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS embedded_wallet_client_type TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_sub_account TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_wallet TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS solana_wallet TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_preference TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_access_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_access_decision_note TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_access_decided_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_access_decided_by TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verifications JSONB NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS csw_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_smart_wallet TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_embedded_eoa TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS border_tier INT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_follow_verified_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_fields JSONB NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprovisioned_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprov_server_wallet_id TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprov_server_wallet_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprov_coin_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprov_coin_symbol TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preprov_zora_handle TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS erc8004_agent_id BIGINT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS erc8128_agent_id TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lens_handle TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lens_account_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lens_owner_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lens_grove_uri TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS canonical_solana_wallet TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS operational_solana_wallet TEXT NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_created_at_idx
  ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_csw_idx
  ON public.profiles (csw_address)
  WHERE csw_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_primary_wallet_lc_idx
  ON public.profiles ((LOWER(primary_wallet)))
  WHERE primary_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_embedded_wallet_lc_idx
  ON public.profiles ((LOWER(embedded_wallet)))
  WHERE embedded_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_primary_embedded_eoa_lc_idx
  ON public.profiles ((LOWER(primary_embedded_eoa)))
  WHERE primary_embedded_eoa IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_lc_idx
  ON public.profiles ((LOWER(primary_smart_wallet)))
  WHERE primary_smart_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_csw_address_lc_idx
  ON public.profiles ((LOWER(csw_address)))
  WHERE csw_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_base_sub_account_lc_idx
  ON public.profiles ((LOWER(base_sub_account)))
  WHERE base_sub_account IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_idx
  ON public.profiles (primary_smart_wallet)
  WHERE primary_smart_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_canonical_solana_wallet_idx
  ON public.profiles (canonical_solana_wallet)
  WHERE canonical_solana_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_operational_solana_wallet_idx
  ON public.profiles (operational_solana_wallet)
  WHERE operational_solana_wallet IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE privy_user_id IS NOT NULL
    GROUP BY privy_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_privy_user_id';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_privy_user_id_unique
  ON public.profiles (privy_user_id)
  WHERE privy_user_id IS NOT NULL;

-- Referrals
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_signup_id BIGINT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_claimed_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_unique
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_referred_by_signup_id_idx
  ON public.profiles (referred_by_signup_id);

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id BIGSERIAL PRIMARY KEY,
  referral_code TEXT NOT NULL,
  referrer_signup_id BIGINT NOT NULL,
  ip_hash TEXT NULL,
  ua_hash TEXT NULL,
  session_id TEXT NULL,
  landing_url TEXT NULL,
  is_bot_suspected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_conversions (
  id BIGSERIAL PRIMARY KEY,
  referral_code TEXT NOT NULL,
  referrer_signup_id BIGINT NOT NULL,
  invitee_signup_id BIGINT NOT NULL UNIQUE,
  ip_hash TEXT NULL,
  ua_hash TEXT NULL,
  session_id TEXT NULL,
  attribution TEXT NOT NULL DEFAULT 'last_click',
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  invalid_reason TEXT NULL,
  status TEXT NULL,
  qualified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referral_conversions ADD COLUMN IF NOT EXISTS status TEXT NULL;
ALTER TABLE public.referral_conversions ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS referral_conversions_referrer_created_idx
  ON public.referral_conversions (referrer_signup_id, created_at DESC);

-- Waitlist points
CREATE TABLE IF NOT EXISTS public.points (
  id BIGSERIAL PRIMARY KEY,
  signup_id BIGINT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NULL,
  amount INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS points_unique_source
  ON public.points (signup_id, source, source_id)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS points_unique_source_full
  ON public.points (signup_id, source, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS points_csw_link_single_shot
  ON public.points (signup_id)
  WHERE source = 'csw_link' AND source_id IS NULL;
CREATE INDEX IF NOT EXISTS points_signup_idx
  ON public.points (signup_id, created_at DESC);

-- Canonical wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  address TEXT PRIMARY KEY,
  chain TEXT NOT NULL DEFAULT 'evm',
  wallet_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_wallets (
  profile_id BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL REFERENCES public.wallets(address) ON DELETE CASCADE,
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account_zora_signals'
      AND column_name = 'canonical_zora_csw_address'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account_zora_signals'
      AND column_name = 'canonical_csw_address'
  ) THEN
    ALTER TABLE public.account_zora_signals
      RENAME COLUMN canonical_zora_csw_address TO canonical_csw_address;
  END IF;
END
$$;

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
CREATE INDEX IF NOT EXISTS profile_wallets_profile_id_idx
  ON public.profile_wallets (profile_id);
CREATE INDEX IF NOT EXISTS profile_wallets_address_lc_idx
  ON public.profile_wallets ((LOWER(address)));
CREATE INDEX IF NOT EXISTS wallets_address_lc_idx
  ON public.wallets ((LOWER(address)));
CREATE INDEX IF NOT EXISTS profile_wallets_profile_chain_idx
  ON public.profile_wallets (profile_id, chain_id);
CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_profile_chain_canonical_unique
  ON public.profile_wallets (profile_id, chain_id)
  WHERE is_canonical_smart_wallet = true;
CREATE INDEX IF NOT EXISTS profile_wallets_canonical_zora_csw_lc_idx
  ON public.profile_wallets ((LOWER(canonical_zora_csw_address)))
  WHERE canonical_zora_csw_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS profile_wallets_privy_embedded_eoa_lc_idx
  ON public.profile_wallets ((LOWER(privy_embedded_eoa_address)))
  WHERE privy_embedded_eoa_address IS NOT NULL;

-- Keepr schema
CREATE TABLE IF NOT EXISTS public.keepr_vaults (
  vault_address TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  group_id TEXT NOT NULL,
  lens_group_address TEXT,
  creator_coin_address TEXT NOT NULL,
  canonical_owner_address TEXT NOT NULL,
  share_token_address TEXT,
  gating_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  join_locked BOOLEAN NOT NULL DEFAULT FALSE,
  gating_mode TEXT NOT NULL DEFAULT 'shares',
  min_shares TEXT,
  fail_closed BOOLEAN NOT NULL DEFAULT TRUE,
  config_version INTEGER NOT NULL DEFAULT 1,
  config_hash TEXT NOT NULL,
  config_json JSONB NOT NULL,
  last_sync_at TIMESTAMPTZ,
  graduated_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  settlement_stage TEXT,
  settlement_stage_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS lens_group_address TEXT;
ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;
ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS settlement_stage TEXT;
ALTER TABLE public.keepr_vaults ADD COLUMN IF NOT EXISTS settlement_stage_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS keepr_vaults_group_id_idx
  ON public.keepr_vaults (group_id);

CREATE TABLE IF NOT EXISTS public.keepr_vault_automation (
  vault_address TEXT PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  canonical_csw_address TEXT NOT NULL,
  embedded_eoa_address TEXT,
  privy_wallet_id TEXT,
  authorization_source TEXT NOT NULL,
  automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  automation_scope TEXT NOT NULL,
  last_owner_check_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS profile_id BIGINT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS canonical_csw_address TEXT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS embedded_eoa_address TEXT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS privy_wallet_id TEXT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS authorization_source TEXT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS automation_scope TEXT;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS last_owner_check_at TIMESTAMPTZ;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.keepr_vault_automation ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS keepr_vault_automation_profile_idx
  ON public.keepr_vault_automation (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS keepr_vault_automation_enabled_idx
  ON public.keepr_vault_automation (automation_enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.keepr_nonces (
  nonce TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS keepr_nonces_wallet_idx
  ON public.keepr_nonces (wallet_address);
CREATE INDEX IF NOT EXISTS keepr_nonces_expires_idx
  ON public.keepr_nonces (expires_at);

CREATE TABLE IF NOT EXISTS public.keepr_actions (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  group_id TEXT NOT NULL,
  action_type TEXT,
  action JSONB NOT NULL,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

ALTER TABLE public.keepr_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE public.keepr_actions ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.keepr_actions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.keepr_actions ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS keepr_actions_status_idx
  ON public.keepr_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS keepr_actions_dedupe_idx
  ON public.keepr_actions (dedupe_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.keepr_logs (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  actor_wallet TEXT,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.keepr_join_requests (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  group_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'watching',
  last_reason TEXT,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  action_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.keepr_join_requests ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE public.keepr_join_requests ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;
ALTER TABLE public.keepr_join_requests ADD COLUMN IF NOT EXISTS action_id BIGINT;

CREATE INDEX IF NOT EXISTS keepr_join_requests_vault_wallet_idx
  ON public.keepr_join_requests (vault_address, wallet_address);

-- One-time compatibility migration from takopi_* tables when present.
DO $$
BEGIN
  IF to_regclass('public.takopi_vaults') IS NOT NULL THEN
    INSERT INTO public.keepr_vaults (
      vault_address,
      chain_id,
      group_id,
      creator_coin_address,
      canonical_owner_address,
      share_token_address,
      gating_enabled,
      join_locked,
      gating_mode,
      min_shares,
      fail_closed,
      config_version,
      config_hash,
      config_json,
      last_sync_at,
      created_at,
      updated_at
    )
    SELECT
      vault_address,
      chain_id,
      group_id,
      creator_coin_address,
      canonical_owner_address,
      share_token_address,
      gating_enabled,
      join_locked,
      gating_mode,
      min_shares,
      fail_closed,
      config_version,
      config_hash,
      config_json,
      last_sync_at,
      created_at,
      updated_at
    FROM public.takopi_vaults
    ON CONFLICT (vault_address) DO NOTHING;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.takopi_nonces') IS NOT NULL THEN
    INSERT INTO public.keepr_nonces (nonce, purpose, wallet_address, vault_address, issued_at, expires_at, used_at)
    SELECT nonce, purpose, wallet_address, vault_address, issued_at, expires_at, used_at
    FROM public.takopi_nonces
    ON CONFLICT (nonce) DO NOTHING;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.takopi_actions') IS NOT NULL THEN
    INSERT INTO public.keepr_actions (id, vault_address, group_id, action, status, last_error, created_at, updated_at, executed_at)
    SELECT id, vault_address, group_id, action, status, last_error, created_at, updated_at, executed_at
    FROM public.takopi_actions
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.takopi_audit_log') IS NOT NULL THEN
    INSERT INTO public.keepr_logs (id, vault_address, actor_wallet, event_type, details, created_at)
    SELECT id, vault_address, actor_wallet, event_type, details, created_at
    FROM public.takopi_audit_log
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.keepr_actions') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('public.keepr_actions', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM public.keepr_actions), 1), 1),
      true
    );
  END IF;

  IF to_regclass('public.keepr_logs') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('public.keepr_logs', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM public.keepr_logs), 1), 1),
      true
    );
  END IF;
END
$$;
