-- Base Creator Metrics tables.
-- Extracted from duplicated runtime bootstrap in frontend/server/_lib/zora/creatorMetricsSync.ts
-- and legacy frontend/db mirrors.

CREATE TABLE IF NOT EXISTS creator_coins (
  coin_address TEXT PRIMARY KEY,
  creator_address TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  market_cap_usd NUMERIC(38, 12),
  volume_24h_usd NUMERIC(38, 12),
  fees_24h_usd NUMERIC(38, 12),
  fee_model TEXT NOT NULL DEFAULT 'v4',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_coins_creator_idx ON creator_coins (creator_address);
CREATE INDEX IF NOT EXISTS creator_coins_created_at_idx ON creator_coins (created_at DESC);
CREATE INDEX IF NOT EXISTS creator_coins_chain_idx ON creator_coins (chain_id);

CREATE TABLE IF NOT EXISTS creators (
  creator_address TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ,
  coin_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creators_last_seen_idx ON creators (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS creator_metrics_state (
  id SMALLINT PRIMARY KEY,
  checkpoint_cursor TEXT,
  checkpoint_block BIGINT,
  checkpoint_log_index INTEGER,
  checkpoint_updated_at TIMESTAMPTZ,
  backfill_complete BOOLEAN NOT NULL DEFAULT false,
  sync_status TEXT NOT NULL DEFAULT 'idle',
  sync_error TEXT,
  sync_error_count INTEGER NOT NULL DEFAULT 0,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_finished_at TIMESTAMPTZ,
  last_full_sync_at TIMESTAMPTZ,
  last_run_id TEXT,
  sampled_creators INTEGER NOT NULL DEFAULT 0,
  drift_estimate_total INTEGER,
  drift_pct NUMERIC(12, 6),
  last_drift_checked_at TIMESTAMPTZ,
  last_hot_refresh_at TIMESTAMPTZ,
  cached_creators_total BIGINT,
  cached_market_cap_usd NUMERIC(38, 12),
  cached_volume_24h_usd NUMERIC(38, 12),
  cached_fees_24h_usd NUMERIC(38, 12),
  cached_totals_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS creator_metrics_daily_snapshots (
  day DATE PRIMARY KEY,
  creators_total BIGINT,
  creator_coins_market_cap_usd NUMERIC(38, 12),
  creator_coins_volume_24h_usd NUMERIC(38, 12),
  creator_coins_fees_24h_usd NUMERIC(38, 12),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_metrics_daily_snapshots_day_idx ON creator_metrics_daily_snapshots (day DESC);

COMMENT ON TABLE creator_coins IS 'Indexed creator coins for metrics / explore.';
COMMENT ON TABLE creators IS 'Indexed creators.';
COMMENT ON TABLE creator_metrics_state IS 'Sync state and cached totals for creator metrics.';
COMMENT ON TABLE creator_metrics_daily_snapshots IS 'Daily aggregated creator metrics snapshots.';
