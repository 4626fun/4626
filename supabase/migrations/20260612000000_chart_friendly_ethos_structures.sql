-- Chart-friendly structures for high-observability load (137+ charts)
-- Safe to run multiple times (idempotent where possible)

-- 1. Fast sort index for Ethos leaderboards / explore sorted by score
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_score_desc
  ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, creator_address);

-- 2. Index for charts that break down by source (owner_class_csw vs social vs wallet etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_source_score
  ON public.creator_ethos_projection (ethos_score_source, ethos_score DESC NULLS LAST)
  WHERE ethos_score_source IS NOT NULL;

-- 3. Small, cheap distribution table for "how many creators per Ethos level" charts
CREATE TABLE IF NOT EXISTS public.creator_ethos_score_distribution (
  level text PRIMARY KEY,
  creator_count bigint NOT NULL DEFAULT 0,
  last_refreshed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.creator_ethos_score_distribution IS 
  'Pre-aggregated histogram for fast Ethos level distribution charts. Refreshed after projection updates.';

-- 4. Cheap function to refresh the distribution (call this from the existing refresh job)
CREATE OR REPLACE FUNCTION public.refresh_creator_ethos_distribution()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.creator_ethos_score_distribution (level, creator_count, last_refreshed_at)
  SELECT 
    ethos_level,
    COUNT(*) AS creator_count,
    NOW()
  FROM public.creator_ethos_projection
  WHERE ethos_level IS NOT NULL
  GROUP BY ethos_level
  ON CONFLICT (level) DO UPDATE SET
    creator_count = EXCLUDED.creator_count,
    last_refreshed_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.refresh_creator_ethos_distribution() IS 
  'Fast function to refresh the distribution table used by many Ethos breakdown charts.';

-- 5. Optional: narrow covering index for common "top market cap with good Ethos" charts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_market_cap_ethos
  ON public.creator_ethos_projection (market_cap_usd DESC NULLS LAST, ethos_score DESC NULLS LAST)
  WHERE market_cap_usd IS NOT NULL;

-- Note: The expensive LATERAL unnest logic should NEVER be used in chart queries.
-- It belongs only inside the controlled refresh job in creatorEthosProjection.ts
