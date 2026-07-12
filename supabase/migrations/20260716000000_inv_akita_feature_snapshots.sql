-- Continuous Hyperliquid market feature snapshots for honest ΔF/ΔOI/ΔV.
-- Separate from backtest_market_bars_1m (price-path cache) and funding_oi_shadow_*.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.market_feature_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol             TEXT NOT NULL,
  observed_at        TIMESTAMPTZ NOT NULL,
  source_provider    TEXT NOT NULL DEFAULT 'hyperliquid-meta-and-asset-ctxs',
  methodology_version TEXT NOT NULL DEFAULT 'market-feature-snapshot-v1.0.0',
  mark_price_usd     NUMERIC(30, 12),
  funding_rate       NUMERIC(24, 16),
  open_interest_usd  NUMERIC(30, 8),
  volume_24h_usd     NUMERIC(30, 8),
  price_change_24h_pct NUMERIC(18, 8),
  oracle_price_usd   NUMERIC(30, 12),
  basis_bps          NUMERIC(18, 8),
  extras             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, observed_at),
  CONSTRAINT market_feature_snapshots_symbol_check CHECK (symbol ~ '^[A-Z0-9]{1,20}$')
);

CREATE INDEX IF NOT EXISTS market_feature_snapshots_symbol_observed_desc_idx
  ON alfaclub.market_feature_snapshots (symbol, observed_at DESC);

CREATE INDEX IF NOT EXISTS market_feature_snapshots_observed_at_idx
  ON alfaclub.market_feature_snapshots (observed_at DESC);

ALTER TABLE alfaclub.market_feature_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE alfaclub.market_feature_snapshots FROM anon, authenticated;

COMMENT ON TABLE alfaclub.market_feature_snapshots IS
  'Advisory-only continuous HL funding/OI/volume snapshots used for honest deltas; never consumed by live execution.';
