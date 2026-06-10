-- Final small set of additive columns that were still being applied via raw
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS in a few bootstrap helpers.
-- Extracted during the last pass of the 2026 schema condensation.

-- Alfaclub publications (additive columns for submission tracking)
ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS submission_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS last_submission_error TEXT;
ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS last_submission_at TIMESTAMPTZ;

-- Creator coins display / sparkline columns (used by explore + metrics)
ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS unique_holders INTEGER;
ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS market_cap_delta_24h NUMERIC(38, 12);
ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS sparkline_30d_values JSONB;
ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS sparkline_30d_change_pct NUMERIC(12, 4);
ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS sparkline_30d_updated_at TIMESTAMPTZ;

-- Creator metrics state cached totals + explore checkpoints
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_block BIGINT;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_log_index INTEGER;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS last_hot_refresh_at TIMESTAMPTZ;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_creators_total BIGINT;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_market_cap_usd NUMERIC(38, 12);
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_volume_24h_usd NUMERIC(38, 12);
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_fees_24h_usd NUMERIC(38, 12);
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_totals_at TIMESTAMPTZ;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_checkpoints_json TEXT;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_backfill_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_last_sync_at TIMESTAMPTZ;

-- Deploys table (runtime scheduling / locking columns)
ALTER TABLE deploys ADD COLUMN IF NOT EXISTS next_run_after TIMESTAMPTZ;
