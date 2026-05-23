-- Cached aggregate totals for /api/zora/metrics fast reads.
-- Idempotent: safe on databases that already picked these up via runtime schema ensure.

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS last_hot_refresh_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS cached_creators_total BIGINT;

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS cached_market_cap_usd NUMERIC(38, 12);

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS cached_volume_24h_usd NUMERIC(38, 12);

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS cached_fees_24h_usd NUMERIC(38, 12);

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS cached_totals_at TIMESTAMPTZ;
