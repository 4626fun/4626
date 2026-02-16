-- Canonical creator metrics backing tables.
-- Idempotent migration for exact creator totals + deterministic aggregates.

-- Per-coin canonical snapshot row (1 row per coin contract).
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

CREATE INDEX IF NOT EXISTS creator_coins_creator_idx
  ON creator_coins (creator_address);

CREATE INDEX IF NOT EXISTS creator_coins_created_at_idx
  ON creator_coins (created_at DESC);

CREATE INDEX IF NOT EXISTS creator_coins_last_seen_idx
  ON creator_coins (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS creator_coins_chain_idx
  ON creator_coins (chain_id);

-- Canonical creator entity row (1 row per unique creator wallet).
CREATE TABLE IF NOT EXISTS creators (
  creator_address TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ,
  coin_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creators_first_seen_idx
  ON creators (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS creators_last_seen_idx
  ON creators (last_seen_at DESC);

-- Sync state + checkpoints (single row with id=1).
CREATE TABLE IF NOT EXISTS creator_metrics_state (
  id SMALLINT PRIMARY KEY,
  checkpoint_cursor TEXT,
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
  last_drift_checked_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_metrics_state_id_check'
  ) THEN
    ALTER TABLE creator_metrics_state
      ADD CONSTRAINT creator_metrics_state_id_check CHECK (id = 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_metrics_state_sync_status_check'
  ) THEN
    ALTER TABLE creator_metrics_state
      ADD CONSTRAINT creator_metrics_state_sync_status_check
      CHECK (sync_status IN ('idle', 'running', 'error'));
  END IF;
END $$;

INSERT INTO creator_metrics_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
