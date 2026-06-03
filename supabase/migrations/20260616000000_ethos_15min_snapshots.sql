-- 15-minute snapshots for the highest-resolution Ethos charts
-- Use sparingly – this table can grow quickly. Recommended retention: 24-48 hours max.

CREATE TABLE IF NOT EXISTS public.creator_ethos_15min_snapshots (
  snapshot_time timestamptz NOT NULL,
  creator_address text NOT NULL,
  ethos_score numeric,
  ethos_level text,
  ethos_score_source text,
  market_cap_usd numeric,
  PRIMARY KEY (snapshot_time, creator_address)
);

COMMENT ON TABLE public.creator_ethos_15min_snapshots IS 
  '15-minute granularity for the most time-sensitive Ethos trend charts. Prune aggressively.';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_15min_snapshots_time_creator
  ON public.creator_ethos_15min_snapshots (snapshot_time DESC, creator_address);

-- Function to snapshot at 15-minute intervals
CREATE OR REPLACE FUNCTION public.snapshot_creator_ethos_15min()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.creator_ethos_15min_snapshots (
    snapshot_time,
    creator_address,
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd
  )
  SELECT
    date_trunc('hour', NOW()) + floor(extract(minute from NOW()) / 15) * interval '15 min',
    lower(creator_address),
    ethos_score,
    ethos_level,
    ethos_score_source,
    market_cap_usd
  FROM public.creator_ethos_projection
  ON CONFLICT (snapshot_time, creator_address) DO UPDATE SET
    ethos_score = EXCLUDED.ethos_score,
    ethos_level = EXCLUDED.ethos_level,
    ethos_score_source = EXCLUDED.ethos_score_source,
    market_cap_usd = EXCLUDED.market_cap_usd;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Prune function (keep last 48 hours by default)
CREATE OR REPLACE FUNCTION public.prune_ethos_15min_snapshots(keep_hours integer DEFAULT 48)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.creator_ethos_15min_snapshots
  WHERE snapshot_time < NOW() - (keep_hours || ' hours')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
