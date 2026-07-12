-- InverseAKITA selective counter-positioning decision ledger + outcomes.
-- Intelligence only; never consumed by live counter-trade execution.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.decision_ledger (
  decision_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at           TIMESTAMPTZ NOT NULL,
  data_as_of            TIMESTAMPTZ NOT NULL,
  venue                 TEXT NOT NULL DEFAULT 'hyperliquid',
  asset                 TEXT NOT NULL,
  source_id             TEXT,
  source_side           TEXT NOT NULL,
  source_entry_price    NUMERIC(30, 12),
  source_notional_usd   NUMERIC(30, 8),
  source_leverage       NUMERIC(18, 8),
  source_timestamp      TIMESTAMPTZ,
  decision              TEXT NOT NULL,
  counter_side          TEXT,
  confidence            NUMERIC(8, 6) NOT NULL,
  regime_fine           TEXT NOT NULL,
  regime_coarse         TEXT,
  methodology_version   TEXT NOT NULL,
  market_state          JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence              JSONB NOT NULL DEFAULT '{}'::jsonb,
  invalidation          JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_risk_pct    NUMERIC(8, 6),
  suggested_notional_usd NUMERIC(30, 8),
  estimated_cost_bps    NUMERIC(18, 8),
  modeled_edge_bps      NUMERIC(18, 8),
  edge_prior_version    TEXT,
  valid_for_minutes     INTEGER,
  evaluation_horizons_hours INTEGER[] NOT NULL DEFAULT '{1,4,8,24}',
  acp_job_id            TEXT,
  shadow_only           BOOLEAN NOT NULL DEFAULT TRUE,
  source_provider       TEXT NOT NULL DEFAULT 'inverse-akita-decision',
  idempotency_key       TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, idempotency_key),
  CONSTRAINT decision_ledger_asset_check CHECK (asset ~ '^[A-Z0-9]{1,20}$'),
  CONSTRAINT decision_ledger_source_side_check CHECK (source_side IN ('LONG', 'SHORT')),
  CONSTRAINT decision_ledger_decision_check CHECK (decision IN ('COUNTER', 'DELAY', 'SKIP')),
  CONSTRAINT decision_ledger_counter_side_check CHECK (
    counter_side IS NULL OR counter_side IN ('LONG', 'SHORT')
  ),
  CONSTRAINT decision_ledger_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT decision_ledger_regime_coarse_check CHECK (
    regime_coarse IS NULL OR regime_coarse IN (
      'crowded-longs', 'crowded-shorts', 'balanced', 'insufficient-data'
    )
  )
);

CREATE TABLE IF NOT EXISTS alfaclub.decision_outcomes (
  decision_id                         UUID NOT NULL REFERENCES alfaclub.decision_ledger(decision_id) ON DELETE CASCADE,
  horizon_hours                       INTEGER NOT NULL,
  due_at                              TIMESTAMPTZ NOT NULL,
  settled_at                          TIMESTAMPTZ,
  mark_at_decision                    NUMERIC(30, 12),
  mark_at_horizon                     NUMERIC(30, 12),
  price_at                            TIMESTAMPTZ,
  return_bps                          NUMERIC(18, 8),
  funding_pnl_bps_est                 NUMERIC(18, 8),
  cost_bps_est                        NUMERIC(18, 8),
  net_bps                             NUMERIC(18, 8),
  would_have_been_always_inverse_bps  NUMERIC(18, 8),
  status                              TEXT NOT NULL DEFAULT 'pending',
  PRIMARY KEY (decision_id, horizon_hours),
  CONSTRAINT decision_outcomes_horizon_check CHECK (horizon_hours IN (1, 4, 8, 24)),
  CONSTRAINT decision_outcomes_status_check CHECK (status IN ('pending', 'settled', 'deferred')),
  CONSTRAINT decision_outcomes_settlement_check CHECK (
    (status = 'pending' AND settled_at IS NULL AND mark_at_horizon IS NULL AND price_at IS NULL AND return_bps IS NULL AND net_bps IS NULL)
    OR (status = 'deferred' AND settled_at IS NULL)
    OR (status = 'settled' AND settled_at IS NOT NULL AND mark_at_horizon IS NOT NULL AND price_at IS NOT NULL AND return_bps IS NOT NULL AND net_bps IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS decision_outcomes_due_idx
  ON alfaclub.decision_outcomes (due_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS decision_ledger_observed_at_idx
  ON alfaclub.decision_ledger (observed_at DESC);

ALTER TABLE alfaclub.decision_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.decision_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.decision_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.decision_outcomes FROM anon, authenticated;

COMMENT ON TABLE alfaclub.decision_ledger IS
  'Advisory COUNTER/DELAY/SKIP decisions; never consumed by live execution paths.';
COMMENT ON TABLE alfaclub.decision_outcomes IS
  'Point-in-time horizon settlements for decision ledger rows; no current-price fallback.';
