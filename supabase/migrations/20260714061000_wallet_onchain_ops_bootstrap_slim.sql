-- Slim runtime bootstrap for wallet/onchain ops tables still in use.
-- Replaces the retired sections of 20260608000000_wallet_onchain_ops_audit_schema.sql
-- (creator_wallets, creator_agent_wallets, csw_owner_link_status were dropped/consolidated).

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

DO $$
BEGIN
  ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS ip_hash TEXT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

COMMENT ON TABLE admin_logs IS 'Audit trail for privileged admin actions (operator / Safe / manual interventions).';
