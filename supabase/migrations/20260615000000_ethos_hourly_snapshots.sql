-- Hourly snapshot table for high-resolution Ethos trend charts
-- Useful for the more detailed charts among the 137+

CREATE TABLE IF NOT EXISTS public.creator_ethos_hourly_snapshots (
  snapshot_hour timestamptz NOT NULL,
  creator_address text NOT NULL,
  ethos_score numeric,
  ethos_level text,
  ethos_score_source text,
  market_cap_usd numeric,
  PRIMARY KEY (snapshot_hour, creator_address)
);

COMMENT ON TABLE public.creator_ethos_hourly_snapshots IS 
  'Hourly snapshots for fine-grained trend analysis. Keep retention short (e.g. 7-14 days) to control size.';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_hourly_snapshots_hour_creator
  ON public.creator_ethos_hourly_snapshots (snapshot_hour DESC, creator_address);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_hourly_snapshots_hour_score
  ON public.creator_ethos_hourly_snapshots (snapshot_hour DESC, ethos_score DESC NULLS LAST);

-- Function to snapshot current projection into the hourly table
CREATE OR REPLACE FUNCTION public.snapshot_creator_ethos_hourly()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.creator_ethos_hourly_snapshots (
    snapshot_hour,
    creator_address,
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd
  )
  SELECT
    date_trunc('hour', NOW()),
    lower(creator_address),
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd
  FROM public.creator_ethos_projection
  ON CONFLICT (snapshot_hour, creator_address) DO UPDATE SET
    ethos_score = EXCLUDED.ethos_score,
    ethos_level = EXCLUDED.ethos_level,
    ethos_score_source = EXCLUDED.ethos_score_source,
    market_cap_usd = EXCLUDED.market_cap_usd;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Prune function (recommended to keep only last 7-14 days for hourly data)
CREATE OR REPLACE FUNCTION public.prune_ethos_hourly_snapshots(keep_hours integer DEFAULT 168) -- 7 days default
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.creator_ethos_hourly_snapshots
  WHERE snapshot_hour < NOW() - (keep_hours || ' hours')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
