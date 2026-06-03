-- One more very strong composite index for the most common Explore path
-- (ethos filter + market cap + volume tiebreaker)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_proj_ethos_mcap_volume_strong
  ON public.creator_ethos_projection (
    ethos_score,
    market_cap_usd DESC NULLS LAST,
    volume_24h_usd DESC NULLS LAST,
    creator_address
  )
  WHERE ethos_score IS NOT NULL;

COMMENT ON INDEX idx_ce_proj_ethos_mcap_volume_strong IS 
  'Strong composite for the most common filtered + sorted Explore queries on the unified source.';
