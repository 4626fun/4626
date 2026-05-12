CREATE TABLE IF NOT EXISTS public.ajna_vaults (
  chain_id INTEGER NOT NULL CHECK (chain_id > 0),
  creator_token TEXT NOT NULL CHECK (creator_token = LOWER(creator_token) AND creator_token ~ '^0x[0-9a-f]{40}$'),
  creator_vault TEXT NOT NULL CHECK (creator_vault = LOWER(creator_vault) AND creator_vault ~ '^0x[0-9a-f]{40}$'),
  strategy_adapter TEXT NOT NULL CHECK (strategy_adapter = LOWER(strategy_adapter) AND strategy_adapter ~ '^0x[0-9a-f]{40}$'),
  inner_ajna_vault TEXT NOT NULL CHECK (inner_ajna_vault = LOWER(inner_ajna_vault) AND inner_ajna_vault ~ '^0x[0-9a-f]{40}$'),
  ajna_auth TEXT NOT NULL CHECK (ajna_auth = LOWER(ajna_auth) AND ajna_auth ~ '^0x[0-9a-f]{40}$'),
  ajna_pool TEXT NOT NULL CHECK (ajna_pool = LOWER(ajna_pool) AND ajna_pool ~ '^0x[0-9a-f]{40}$'),
  owner_address TEXT NOT NULL CHECK (owner_address = LOWER(owner_address) AND owner_address ~ '^0x[0-9a-f]{40}$'),
  buffer_ratio_bps INTEGER NULL CHECK (buffer_ratio_bps BETWEEN 0 AND 10000),
  min_bucket_index INTEGER NULL CHECK (min_bucket_index BETWEEN 0 AND 7388),
  max_bucket_step INTEGER NOT NULL DEFAULT 20 CHECK (max_bucket_step BETWEEN 1 AND 1000),
  max_assets_per_move NUMERIC(78, 0) NULL CHECK (max_assets_per_move IS NULL OR max_assets_per_move >= 0),
  automation_status TEXT NOT NULL DEFAULT 'paused' CHECK (automation_status IN ('dry_run', 'live', 'paused', 'halted')),
  last_run_at TIMESTAMPTZ NULL,
  last_success_tx TEXT NULL CHECK (last_success_tx IS NULL OR last_success_tx ~ '^0x[0-9a-fA-F]{64}$'),
  last_error TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, creator_token, strategy_adapter)
);

CREATE INDEX IF NOT EXISTS ajna_vaults_status_idx
  ON public.ajna_vaults (automation_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ajna_vaults_creator_vault_idx
  ON public.ajna_vaults (creator_vault, updated_at DESC);

CREATE INDEX IF NOT EXISTS ajna_vaults_owner_idx
  ON public.ajna_vaults (owner_address, updated_at DESC);

ALTER TABLE public.ajna_vaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest" ON public.ajna_vaults;
CREATE POLICY "deny_public_rest"
  ON public.ajna_vaults
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
