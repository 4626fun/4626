-- Read-only Funding/OI regime observations and their fixed-horizon outcomes.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.funding_oi_shadow_observation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol                TEXT NOT NULL,
  observed_at           TIMESTAMPTZ NOT NULL,
  source_provider       TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL,
  classifier_version    TEXT NOT NULL,
  data_quality          TEXT NOT NULL,
  missing_fields        TEXT[] NOT NULL DEFAULT '{}',
  mark_price_usd        NUMERIC(30, 12),
  funding_rate          NUMERIC(24, 16),
  open_interest_usd     NUMERIC(30, 8),
  volume_24h_usd        NUMERIC(30, 8),
  price_change_24h_pct  NUMERIC(18, 8),
  regime                TEXT NOT NULL,
  funding_bias          TEXT NOT NULL,
  oi_participation      TEXT NOT NULL,
  confidence            INTEGER NOT NULL,
  reasons               TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, idempotency_key),
  CONSTRAINT funding_oi_shadow_observation_symbol_check CHECK (symbol ~ '^[A-Z0-9]{1,20}$'),
  CONSTRAINT funding_oi_shadow_observation_regime_check
    CHECK (regime IN ('crowded-longs', 'crowded-shorts', 'balanced', 'insufficient-data')),
  CONSTRAINT funding_oi_shadow_observation_bias_check
    CHECK (funding_bias IN ('longs-paying', 'shorts-paying', 'flat', 'unknown')),
  CONSTRAINT funding_oi_shadow_observation_participation_check
    CHECK (oi_participation IN ('high', 'moderate', 'low', 'unknown')),
  CONSTRAINT funding_oi_shadow_observation_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT funding_oi_shadow_observation_data_quality_check
    CHECK (data_quality IN ('complete', 'partial', 'insufficient'))
);

CREATE TABLE IF NOT EXISTS alfaclub.funding_oi_shadow_outcome (
  observation_id    UUID NOT NULL REFERENCES alfaclub.funding_oi_shadow_observation(id) ON DELETE CASCADE,
  horizon_hours     INTEGER NOT NULL,
  due_at            TIMESTAMPTZ NOT NULL,
  settled_at        TIMESTAMPTZ,
  price_at          TIMESTAMPTZ,
  settled_price_usd NUMERIC(30, 12),
  return_pct        NUMERIC(18, 8),
  PRIMARY KEY (observation_id, horizon_hours),
  CONSTRAINT funding_oi_shadow_outcome_horizon_check CHECK (horizon_hours IN (1, 4, 24)),
  CONSTRAINT funding_oi_shadow_outcome_settlement_check CHECK (
    (settled_at IS NULL AND price_at IS NULL AND settled_price_usd IS NULL AND return_pct IS NULL)
    OR (settled_at IS NOT NULL AND price_at IS NOT NULL AND settled_price_usd IS NOT NULL AND return_pct IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS funding_oi_shadow_outcome_due_idx
  ON alfaclub.funding_oi_shadow_outcome (due_at ASC)
  WHERE settled_at IS NULL;

ALTER TABLE alfaclub.funding_oi_shadow_observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.funding_oi_shadow_outcome ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE alfaclub.funding_oi_shadow_observation FROM anon, authenticated;
REVOKE ALL ON TABLE alfaclub.funding_oi_shadow_outcome FROM anon, authenticated;

COMMENT ON TABLE alfaclub.funding_oi_shadow_observation IS
  'Advisory-only Funding/OI regime snapshots; never consumed by live execution paths.';
COMMENT ON TABLE alfaclub.funding_oi_shadow_outcome IS
  'Fixed 1h, 4h, and 24h mark-price outcomes used to evaluate shadow observations.';
