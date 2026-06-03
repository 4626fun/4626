-- Unified, interconnected Ethos chart support structures
-- Goal: Everything derives from creator_ethos_projection + time-series snapshots.
-- No fragmented independent bucket tables.

-- 1. Add useful dimensions to the main projection if missing (idempotent)
DO $$
BEGIN
    -- Add first_seen_date if it helps with age calculations (computed via snapshots is usually better)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'creator_ethos_projection' AND column_name = 'first_seen_date'
    ) THEN
        ALTER TABLE public.creator_ethos_projection 
        ADD COLUMN first_seen_date date;
    END IF;
END $$;

-- 2. Create a small set of **materialized views** (not separate tables) for common chart patterns.
-- These stay tightly connected to the source tables.

-- Distribution by Ethos Level (refreshed from projection)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ethos_level_distribution AS
SELECT 
    COALESCE(ethos_level, 'unknown') as level,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_score,
    NOW() as refreshed_at
FROM public.creator_ethos_projection
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ethos_level_distribution_level 
    ON public.mv_ethos_level_distribution (level);

-- Breakdown by Score Source
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ethos_by_source AS
SELECT 
    COALESCE(ethos_score_source, 'unknown') as source,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_score,
    NOW() as refreshed_at
FROM public.creator_ethos_projection
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ethos_by_source 
    ON public.mv_ethos_by_source (source);

-- Market Cap Tier Breakdown (derived, not a separate stored table)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ethos_by_market_cap_tier AS
SELECT 
    CASE
        WHEN market_cap_usd < 100000 THEN '0-100k'
        WHEN market_cap_usd < 1000000 THEN '100k-1m'
        WHEN market_cap_usd < 10000000 THEN '1m-10m'
        ELSE '10m+'
    END as market_cap_tier,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos,
    NOW() as refreshed_at
FROM public.creator_ethos_projection
WHERE market_cap_usd IS NOT NULL
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ethos_market_cap_tier 
    ON public.mv_ethos_by_market_cap_tier (market_cap_tier);

-- Volume Tier Breakdown
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ethos_by_volume_tier AS
SELECT 
    CASE
        WHEN volume_24h_usd < 10000 THEN '0-10k'
        WHEN volume_24h_usd < 100000 THEN '10k-100k'
        WHEN volume_24h_usd < 1000000 THEN '100k-1m'
        ELSE '1m+'
    END as volume_tier,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos,
    NOW() as refreshed_at
FROM public.creator_ethos_projection
WHERE volume_24h_usd IS NOT NULL
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ethos_volume_tier 
    ON public.mv_ethos_by_volume_tier (volume_tier);

-- 3. Helper view for age cohorts (computed from snapshots + projection)
CREATE OR REPLACE VIEW public.v_ethos_by_creator_age AS
WITH first_seen AS (
    SELECT 
        creator_address,
        MIN(snapshot_date) as first_seen_date
    FROM public.creator_ethos_daily_snapshots
    GROUP BY creator_address
)
SELECT 
    CASE
        WHEN fs.first_seen_date >= CURRENT_DATE - INTERVAL '7 days' THEN 'new (<7d)'
        WHEN fs.first_seen_date >= CURRENT_DATE - INTERVAL '30 days' THEN '1-4w'
        WHEN fs.first_seen_date >= CURRENT_DATE - INTERVAL '90 days' THEN '1-3m'
        ELSE '3m+'
    END as age_bucket,
    COUNT(*) as creator_count,
    AVG(p.ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.ethos_score) as median_ethos
FROM first_seen fs
JOIN public.creator_ethos_projection p ON p.creator_address = fs.creator_address
WHERE p.ethos_score IS NOT NULL
GROUP BY 1;

-- 4. Refresh function that refreshes all the interconnected materialized views together
CREATE OR REPLACE FUNCTION public.refresh_all_ethos_chart_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ethos_level_distribution;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ethos_by_source;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ethos_by_market_cap_tier;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ethos_by_volume_tier;
END;
$$;

COMMENT ON FUNCTION public.refresh_all_ethos_chart_views() IS 
  'Refreshes all interconnected Ethos chart materialized views in one atomic operation. Call after projection refresh.';

-- Note: The time-series snapshots (daily/hourly/15min) remain as the historical store.
-- All chart segmentations should prefer the materialized views above + the snapshots
-- rather than creating more independent tables.
