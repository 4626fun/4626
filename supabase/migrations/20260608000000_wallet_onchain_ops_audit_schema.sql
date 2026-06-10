-- Wallet/creator wallet tracking, Solana sweep jobs, Meteora Alpha Vault config,
-- and admin audit logs.
-- Extracted from duplicated runtime bootstrap in:
--   frontend/server/_lib/wallet/creatorWallets.ts
--   frontend/server/_lib/wallet/creatorAgentWallets.ts
--   frontend/server/_lib/wallet/cswOwnerLinkStatus.ts
--   frontend/server/_lib/onchain/solanaSweepJobs.ts
--   frontend/server/_lib/onchain/meteoraAlphaVaultConfig.ts
--   frontend/server/_lib/admin/adminAudit.ts

-- Per-creator secondary wallets (e.g. operational, treasury, etc.).
CREATE TABLE IF NOT EXISTS creator_wallets (
  id BIGSERIAL PRIMARY KEY,
  coin_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_role TEXT NOT NULL,
  verified_via TEXT NOT NULL DEFAULT 'siwe',
  privy_user_id TEXT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (best-effort; ignore in restricted runtimes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_wallets'
      AND policyname = 'deny_public_rest'
  ) THEN
    ALTER TABLE creator_wallets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "deny_public_rest" ON creator_wallets
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE creator_wallets IS 'Additional wallets registered per creator coin (operational, treasury, etc.).';

-- Agent (server) wallets created for creators via Privy.
CREATE TABLE IF NOT EXISTS creator_agent_wallets (
  coin_address TEXT PRIMARY KEY,
  agent_wallet_id TEXT NOT NULL,
  agent_wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE creator_agent_wallets IS 'Privy server wallets provisioned as agent signers for a creator.';

-- CSW owner-link status / onboarding health per profile.
CREATE TABLE IF NOT EXISTS csw_owner_link_status (
  profile_id BIGINT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  privy_user_id TEXT NULL,
  embedded_eoa TEXT NULL,
  canonical_smart_wallet TEXT NULL,
  owner_linked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  reason TEXT NULL,
  suggested_canonical_smart_wallet TEXT NULL,
  metadata JSONB NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill columns (safe re-apply).
DO $$
BEGIN
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS privy_user_id TEXT NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS embedded_eoa TEXT NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS canonical_smart_wallet TEXT NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS owner_linked BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'owner_link_missing';
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS reason TEXT NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS suggested_canonical_smart_wallet TEXT NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  -- older Postgres or permission-restricted context; ignore
  NULL;
END
$$;

-- RLS + status CHECK constraint (best effort).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'csw_owner_link_status'
      AND policyname = 'csw_owner_link_status_deny_all'
  ) THEN
    ALTER TABLE csw_owner_link_status ENABLE ROW LEVEL SECURITY;
    CREATE POLICY csw_owner_link_status_deny_all
      ON csw_owner_link_status
      FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'csw_owner_link_status_status_check'
  ) THEN
    ALTER TABLE csw_owner_link_status
      ADD CONSTRAINT csw_owner_link_status_status_check
      CHECK (status IN (
        'linked_ok',
        'linked_mapping_mismatch',
        'owner_link_missing',
        'canonical_wallet_mismatch',
        'canonical_wallet_missing',
        'embedded_eoa_missing',
        'rpc_error'
      ));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS csw_owner_link_status_status_idx ON csw_owner_link_status (status);
CREATE INDEX IF NOT EXISTS csw_owner_link_status_checked_idx ON csw_owner_link_status (checked_at DESC);
CREATE INDEX IF NOT EXISTS csw_owner_link_status_privy_user_idx ON csw_owner_link_status (privy_user_id);
CREATE INDEX IF NOT EXISTS csw_owner_link_status_owner_linked_idx
  ON csw_owner_link_status (owner_linked, checked_at DESC);

COMMENT ON TABLE csw_owner_link_status IS 'Per-profile CSW owner-install health and linkage status for onboarding flows.';

-- Solana sweep / bridge jobs for operational wallets.
CREATE TABLE IF NOT EXISTS solana_sweep_jobs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operational_wallet TEXT NOT NULL,
  canonical_wallet TEXT NOT NULL,
  min_lamports NUMERIC(78, 0) NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_sig TEXT NULL,
  last_error TEXT NULL,
  next_retry_at TIMESTAMPTZ NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'retrying', 'processing', 'succeeded', 'failed', 'blocked', 'cancelled')),
  CHECK (max_attempts >= 1)
);

CREATE INDEX IF NOT EXISTS solana_sweep_jobs_status_idx
  ON solana_sweep_jobs (status, next_retry_at, created_at DESC);
CREATE INDEX IF NOT EXISTS solana_sweep_jobs_profile_idx
  ON solana_sweep_jobs (profile_id, created_at DESC);

COMMENT ON TABLE solana_sweep_jobs IS 'Durable job queue for sweeping SOL from operational Solana wallets back to canonical.';

-- Per-creator Meteora Alpha Vault configuration (Solana side of bridge strategy).
CREATE TABLE IF NOT EXISTS creator_meteora_alpha_vaults (
  creator_token TEXT PRIMARY KEY,
  meteora_alpha_vault TEXT NOT NULL,
  alpha_vault_program_id TEXT NOT NULL,
  deposit_accounts JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (best effort).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_meteora_alpha_vaults'
      AND policyname = 'creator_meteora_alpha_vaults_deny_all'
  ) THEN
    ALTER TABLE creator_meteora_alpha_vaults ENABLE ROW LEVEL SECURITY;
    CREATE POLICY creator_meteora_alpha_vaults_deny_all
      ON creator_meteora_alpha_vaults
      FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS creator_meteora_alpha_vaults_enabled_idx
  ON creator_meteora_alpha_vaults (enabled, updated_at DESC);

COMMENT ON TABLE creator_meteora_alpha_vaults IS 'Mapping of creator token → Meteora Alpha Vault (Solana) for the bridge mesh strategy.';

-- Admin action audit log (sensitive operations).
CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_address TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NULL,
  ip_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill column for older rows.
DO $$
BEGIN
  ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS ip_hash TEXT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

COMMENT ON TABLE admin_logs IS 'Audit trail for privileged admin actions (operator / Safe / manual interventions).';
