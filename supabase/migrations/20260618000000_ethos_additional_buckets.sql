-- Additional pre-aggregated bucket tables for segmented Ethos charts

-- 1. Volume-based buckets (useful for liquidity/volume vs Ethos analysis)
CREATE TABLE IF NOT EXISTS public.creator_ethos_by_volume_bucket (
  bucket text PRIMARY KEY,           -- e.g. '0-10k', '10k-100k', '100k-1m', '1m+'
  creator_count bigint,
  avg_ethos numeric,
  median_ethos numeric,
  last_refreshed_at timestamptz
);

COMMENT ON TABLE public.creator_ethos_by_volume_bucket IS 
  'Ethos stats bucketed by 24h volume. Powers volume-segmented charts.';

CREATE OR REPLACE FUNCTION public.refresh_ethos_volume_buckets()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.creator_ethos_by_volume_bucket;

  INSERT INTO public.creator_ethos_by_volume_bucket (bucket, creator_count, avg_ethos, median_ethos, last_refreshed_at)
  SELECT
    CASE
      WHEN volume_24h_usd < 10000 THEN '0-10k'
      WHEN volume_24h_usd < 100000 THEN '10k-100k'
      WHEN volume_24h_usd < 1000000 THEN '100k-1m'
      ELSE '1m+'
    END AS bucket,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos,
    NOW()
  FROM public.creator_ethos_projection
  WHERE volume_24h_usd IS NOT NULL
  GROUP BY 1;
END;
$$;

-- 2. Creator "age" buckets (based on first seen date in snapshots)
CREATE TABLE IF NOT EXISTS public.creator_ethos_by_age_bucket (
  bucket text PRIMARY KEY,           -- e.g. 'new (<7d)', '1-4w', '1-3m', '3m+'
  creator_count bigint,
  avg_ethos numeric,
  median_ethos numeric,
  last_refreshed_at timestamptz
);

COMMENT ON TABLE public.creator_ethos_by_age_bucket IS 
  'Ethos stats bucketed by how long the creator has had data. Useful for cohort-style charts.';

CREATE OR REPLACE FUNCTION public.refresh_ethos_age_buckets()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.creator_ethos_by_age_bucket;

  INSERT INTO public.creator_ethos_by_age_bucket (bucket, creator_count, avg_ethos, median_ethos, last_refreshed_at)
  SELECT
    CASE
      WHEN first_seen >= CURRENT_DATE - INTERVAL '7 days' THEN 'new (<7d)'
      WHEN first_seen >= CURRENT_DATE - INTERVAL '30 days' THEN '1-4w'
      WHEN first_seen >= CURRENT_DATE - INTERVAL '90 days' THEN '1-3m'
      ELSE '3m+'
    END AS bucket,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos,
    NOW()
  FROM (
    SELECT 
      creator_address,
      MIN(snapshot_date) as first_seen,
      (SELECT ethos_score FROM public.creator_ethos_projection WHERE creator_address = s.creator_address) as ethos_score
    FROM public.creator_ethos_daily_snapshots s
    GROUP BY creator_address
  ) aged
  WHERE ethos_score IS NOT NULL
  GROUP BY 1;
END;
$$;
