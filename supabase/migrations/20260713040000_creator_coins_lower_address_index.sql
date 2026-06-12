-- Sparkline precompute and coin-detail reads filter on lower(coin_address), but the only
-- address index was the raw-cased PK -- every UPDATE/SELECT in that family seq-scanned the
-- ~1M-row table (~1s per call, 30K+ calls observed in pg_stat_statements). Stored values are
-- already lowercase; this expression index turns those into sub-ms index lookups.
CREATE INDEX IF NOT EXISTS idx_creator_coins_coin_address_lower
  ON public.creator_coins (lower(coin_address));
