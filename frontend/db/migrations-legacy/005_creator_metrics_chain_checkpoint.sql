-- Add durable onchain checkpoint columns for creator metrics sync.
-- This keeps backfill progress independent of SDK pagination windows.

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS checkpoint_block BIGINT;

ALTER TABLE IF EXISTS creator_metrics_state
  ADD COLUMN IF NOT EXISTS checkpoint_log_index INTEGER;
