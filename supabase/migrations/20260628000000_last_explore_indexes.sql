-- Final round of indexes for Explore on the unified source.

-- Common: Sort by created_at (new creators) with good Ethos tiebreaker
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_created_ethos
  ON public.creator_ethos_projection (created_at DESC, ethos_score DESC NULLS LAST, creator_address)
  WHERE ethos_score IS NOT NULL;

-- For "trending" style sorts that combine volume + ethos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_volume_ethos_trending
  ON public.creator_ethos_projection (volume_24h_usd DESC NULLS LAST, ethos_score DESC NULLS LAST, creator_address);

COMMENT ON INDEX idx_ce_proj_created_ethos IS 'Supports "New Creators" list sorted with Ethos tiebreaker on unified data';
COMMENT ON INDEX idx_ce_proj_volume_ethos_trending IS 'Supports volume + ethos combined sorts on the single source';
