-- Final targeted indexes for common Explore filter + sort patterns
-- All on the unified source (creator_ethos_projection / v_explore_creators)

-- Ethos filter active + sort by created_at (new + good ethos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_filter_new
  ON public.creator_ethos_projection (ethos_score, created_at DESC, creator_address)
  WHERE ethos_score IS NOT NULL;

-- High market cap + high ethos (common "quality" filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_high_mcap_high_ethos
  ON public.creator_ethos_projection (market_cap_usd, ethos_score DESC NULLS LAST, creator_address)
  WHERE market_cap_usd > 500000 AND ethos_score IS NOT NULL;

-- Volume + market cap tiebreaker (for volume-sorted lists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_volume_mcap
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address);

COMMENT ON INDEX idx_ce_proj_ethos_filter_new IS 'Explore: ethosMin + sort by newest with good ethos';
COMMENT ON INDEX idx_ce_proj_high_mcap_high_ethos IS 'Explore: quality filter (high mcap + high ethos)';
