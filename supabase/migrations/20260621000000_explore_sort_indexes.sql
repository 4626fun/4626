-- Indexes to make Explore/Creators sorting by different columns efficient
-- against the single unified creator_ethos_projection table.

-- Common sort: Market Cap highest (with secondary sorts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_market_cap_desc
  ON public.creator_ethos_projection (market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address);

-- Common sort: Ethos Score highest
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_ethos_desc
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address);

-- Common sort: Volume highest
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_volume_desc
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address);

-- For filtering + sorting combinations often used on Explore
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_ethos_market_cap
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST)
  WHERE ethos_score IS NOT NULL;

COMMENT ON INDEX idx_creator_ethos_projection_market_cap_desc IS 'Supports Explore sorted by Market Cap';
COMMENT ON INDEX idx_creator_ethos_projection_ethos_desc IS 'Supports Explore sorted by Ethos Score';
