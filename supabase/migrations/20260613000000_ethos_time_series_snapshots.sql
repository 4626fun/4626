-- Time-series snapshot table for Ethos trend charts (supports 137+ charts efficiently)
-- Pre-aggregated daily/periodic snapshots so trend charts don't hammer the main projection table.

CREATE TABLE IF NOT EXISTS public.creator_ethos_daily_snapshots (
  snapshot_date date NOT NULL,
  creator_address text NOT NULL,
  ethos_score numeric,
  ethos_level text,
  ethos_score_source text,
  market_cap_usd numeric,
  volume_24h_usd numeric,
  PRIMARY KEY (snapshot_date, creator_address)
);

COMMENT ON TABLE public.creator_ethos_daily_snapshots IS 
  'Daily snapshots of creator Ethos data for efficient trend/time-series charts. Refreshed after projection updates.';

-- Fast index for common time-series chart queries (date range + creator)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_daily_snapshots_date_creator
  ON public.creator_ethos_daily_snapshots (snapshot_date DESC, creator_address);

-- Index for "top creators by score on a given day" charts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_daily_snapshots_date_score
  ON public.creator_ethos_daily_snapshots (snapshot_date DESC, ethos_score DESC NULLS LAST);

-- Function to snapshot the current projection into the daily table
CREATE OR REPLACE FUNCTION public.snapshot_creator_ethos_daily()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.creator_ethos_daily_snapshots (
    snapshot_date,
    creator_address,
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd,
    volume_24h_usd
  )
  SELECT
    CURRENT_DATE,
    lower(creator_address),
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd,
    volume_24h_usd
  FROM public.creator_ethos_projection
  ON CONFLICT (snapshot_date, creator_address) DO UPDATE SET
    ethos_score = EXCLUDED.ethos_score,
    ethos_level = EXCLUDED.ethos_level,
    ethos_score_source = EXCLUDED.ethos_score_source,
    market_cap_usd = EXCLUDED.market_cap_usd,
    volume_24h_usd = EXCLUDED.volume_24h_usd;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.snapshot_creator_ethos_daily() IS 
  'Snapshots current projection data into the daily time-series table. Call after projection refresh for trend charts.';

-- Optional: keep only last N days to control size (example: 90 days)
-- Can be called from a daily pg_cron job.
CREATE OR REPLACE FUNCTION public.prune_ethos_daily_snapshots(keep_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.creator_ethos_daily_snapshots
  WHERE snapshot_date < CURRENT_DATE - (keep_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
