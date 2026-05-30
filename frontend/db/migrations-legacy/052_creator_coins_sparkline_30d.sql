-- Cached 30d explore table sparklines (write-through from /api/zora/exploreSparklines).

ALTER TABLE public.creator_coins
  ADD COLUMN IF NOT EXISTS sparkline_30d_values JSONB,
  ADD COLUMN IF NOT EXISTS sparkline_30d_change_pct NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS sparkline_30d_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.creator_coins.sparkline_30d_values IS
  'Daily price closes for 30d table sparkline; populated by exploreSparklines write-through cache.';
COMMENT ON COLUMN public.creator_coins.sparkline_30d_change_pct IS
  '30d percent change derived from sparkline_30d_values first/last close.';
COMMENT ON COLUMN public.creator_coins.sparkline_30d_updated_at IS
  'When sparkline_30d_values was last refreshed from Zora swap history.';
