-- Final set of composite indexes to make common Explore filter + sort combinations fast
-- on the single unified source (creator_ethos_projection / v_explore_creators).

-- Ethos filter + Market Cap sort (very common when user has an ethosMin filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_filter_mcap_sort
  ON public.creator_ethos_projection (ethos_score, market_cap_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- Market Cap filter + Ethos sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_mcap_filter_ethos_sort
  ON public.creator_ethos_projection (market_cap_usd, ethos_score DESC NULLS LAST, creator_address)
  WHERE market_cap_usd IS NOT NULL;

COMMENT ON INDEX idx_ce_proj_ethos_filter_mcap_sort IS 
  'Supports Explore with ethosMin filter + sorted by market cap';
COMMENT ON INDEX idx_ce_proj_mcap_filter_ethos_sort IS 
  'Supports Explore with market cap filter + sorted by ethos';
