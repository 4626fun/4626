CREATE TABLE IF NOT EXISTS public.keeper_cre_attestations (
  id BIGSERIAL PRIMARY KEY,
  dedupe_key TEXT NOT NULL,
  attestation_kind TEXT NOT NULL CHECK (attestation_kind IN ('solana_nav', 'strategy_health', 'creator_oracle')),
  status TEXT NOT NULL CHECK (
    status IN (
      'ingested',
      'shadow_only',
      'queued',
      'rejected',
      'executed',
      'execution_failed'
    )
  ),
  strategy_address TEXT,
  vault_address TEXT,
  creator_token_address TEXT,
  oracle_address TEXT,
  report_id TEXT,
  nav_value TEXT,
  proposed_price TEXT,
  report_timestamp TIMESTAMPTZ,
  source TEXT NOT NULL,
  attestation_digest TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision JSONB,
  execution_job_id BIGINT REFERENCES public.keeper_jobs(id) ON DELETE SET NULL,
  execution_tx_hash TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS keeper_cre_attestations_kind_status_idx
  ON public.keeper_cre_attestations (attestation_kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS keeper_cre_attestations_strategy_report_idx
  ON public.keeper_cre_attestations (strategy_address, report_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.keeper_cre_strategy_health (
  id BIGSERIAL PRIMARY KEY,
  vault_address TEXT NOT NULL,
  strategy_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'stale', 'unknown')),
  confidence_bps INTEGER NOT NULL CHECK (confidence_bps >= 0 AND confidence_bps <= 10_000),
  report_timestamp TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  attestation_digest TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vault_address, strategy_address)
);

CREATE INDEX IF NOT EXISTS keeper_cre_strategy_health_vault_idx
  ON public.keeper_cre_strategy_health (vault_address, status, report_timestamp DESC);

ALTER TABLE public.keeper_cre_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keeper_cre_strategy_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_rest" ON public.keeper_cre_attestations;
CREATE POLICY "deny_public_rest"
  ON public.keeper_cre_attestations
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_rest" ON public.keeper_cre_strategy_health;
CREATE POLICY "deny_public_rest"
  ON public.keeper_cre_strategy_health
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
