-- Pre-computed bucketed stats for market-cap-segmented Ethos charts
-- Refreshed on a schedule or after projection updates.

CREATE TABLE IF NOT EXISTS public.creator_ethos_by_market_cap_bucket (
  bucket text PRIMARY KEY,           -- e.g. '0-100k', '100k-1m', '1m-10m', '10m+'
  creator_count bigint,
  avg_ethos numeric,
  median_ethos numeric,
  last_refreshed_at timestamptz
);

COMMENT ON TABLE public.creator_ethos_by_market_cap_bucket IS 
  'Aggregated Ethos stats per market cap tier. Powers segmented charts without expensive runtime bucketing.';

-- Simple refresh function (can be called from the main refresh job or a cron)
CREATE OR REPLACE FUNCTION public.refresh_ethos_market_cap_buckets()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clear and rebuild (small table)
  DELETE FROM public.creator_ethos_by_market_cap_bucket;

  INSERT INTO public.creator_ethos_by_market_cap_bucket (bucket, creator_count, avg_ethos, median_ethos, last_refreshed_at)
  SELECT
    CASE
      WHEN market_cap_usd < 100000 THEN '0-100k'
      WHEN market_cap_usd < 1000000 THEN '100k-1m'
      WHEN market_cap_usd < 10000000 THEN '1m-10m'
      ELSE '10m+'
    END AS bucket,
    COUNT(*) as creator_count,
    AVG(ethos_score) as avg_ethos,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ethos_score) as median_ethos,
    NOW()
  FROM public.creator_ethos_projection
  WHERE market_cap_usd IS NOT NULL
  GROUP BY 1;
END;
$$;
