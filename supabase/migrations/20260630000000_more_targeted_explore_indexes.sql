-- Additional high-value indexes for common Explore filter + sort patterns
-- All on the single unified source (creator_ethos_projection / v_explore_creators)

-- 1. Ethos filter + sort by created_at (new + good ethos) - already partially covered, making it more complete
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_filter_created
  ON public.creator_ethos_projection (ethos_score, created_at DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- 2. For "trending" style (volume + recent + good ethos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_volume_recent_ethos
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, created_at DESC, ethos_score DESC NULLS LAST, creator_address);

-- 3. Strong composite for the most common Explore path: 
--    Filter by ethos_min + sort by market_cap (very frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_mcap_popular
  ON public.creator_ethos_projection (ethos_score, market_cap_usd DESC NULLS LAST, volume_24h_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

COMMENT ON INDEX idx_ce_proj_ethos_filter_created IS 'Explore: ethosMin filter + sort by newest';
COMMENT ON INDEX idx_ce_proj_volume_recent_ethos IS 'Supports volume-first trending lists with recency tiebreaker';
COMMENT ON INDEX idx_ce_proj_ethos_mcap_popular IS 'High-traffic path: ethos filter + market cap sort';
