-- Additional indexes for realistic Explore filter + sort patterns on the unified source.

-- With ethosMin filter + sort by market cap (very common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_filter_mcap
  ON public.creator_ethos_projection (ethos_score, market_cap_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- With ethosMin + sort by volume
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_filter_volume
  ON public.creator_ethos_projection (ethos_score, volume_24h_usd DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- Market cap filter + sort by ethos (for "only big creators, sorted by ethos")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_mcap_filter_ethos
  ON public.creator_ethos_projection (market_cap_usd, ethos_score DESC NULLS LAST, creator_address)
  WHERE market_cap_usd IS NOT NULL;

-- Composite for "new creators with good ethos" (created_at + ethos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_new_good_ethos
  ON public.creator_ethos_projection (created_at DESC, ethos_score DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

COMMENT ON INDEX idx_ce_proj_ethos_filter_mcap IS 'Explore: ethosMin filter + Market Cap sort';
COMMENT ON INDEX idx_ce_proj_mcap_filter_ethos IS 'Explore: market cap filter + Ethos sort';
