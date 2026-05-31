-- Additional composite indexes for common Explore/Creators sort + filter patterns.
-- All indexes are on the single source table (creator_ethos_projection) so different
-- sort orders share the same data.

-- Ethos + Market Cap (very common on Explore)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_mcap
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- Market Cap + Ethos (the reverse common order)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_mcap_ethos
  ON public.creator_ethos_projection (market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address);

-- Volume + Ethos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_volume_ethos
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address);

-- Ethos only (for pure "highest ethos" sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_only
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- Market Cap only (for pure market cap sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_mcap_only
  ON public.creator_ethos_projection (market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address);

COMMENT ON INDEX idx_ce_proj_ethos_mcap IS 'Supports Explore sorted by Ethos (with market cap tiebreaker)';
COMMENT ON INDEX idx_ce_proj_mcap_ethos IS 'Supports Explore sorted by Market Cap (with ethos tiebreaker)';
