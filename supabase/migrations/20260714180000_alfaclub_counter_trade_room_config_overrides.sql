-- Room-level counter-trade tuning overrides (set via /strategy config in AlfaClub).

ALTER TABLE alfaclub.counter_trade_room_strategy
  ADD COLUMN IF NOT EXISTS config_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN alfaclub.counter_trade_room_strategy.config_overrides IS
  'Per-room counter-trade overrides (rebalance %, harvest/defend knobs). Merged over env defaults at runtime.';
