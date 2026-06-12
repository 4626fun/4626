-- Ethos index + daily-snapshot optimization (2026-07)
--
-- 1) Drop duplicate / never-used indexes (~440 MB), verified 0 scans in pg_stat_user_indexes:
--    - idx_creator_coins_chain_creator_rank: near-duplicate of creator_coins_chain_creator_rank_idx
--      (the lower(creator_address) variant is the one the planner uses; this raw variant had 0 scans).
--    - creator_coins_chain_idx: single-value column (all rows chain_id = 8453); planner never uses it.
--    - idx_ethos_daily_snapshots_date_creator / _date_score: 0 scans; the primary key
--      (snapshot_date, creator_address) already covers the access paths.
--    - idx_creator_ethos_projection_score_desc: byte-for-byte duplicate of creator_ethos_projection_score_idx.
-- 2) Restrict snapshot_creator_ethos_daily() to scored rows only. NULL-score rows were 82% of every
--    daily snapshot (~83.7K rows/day vs ~15K scored) and can never produce a trend chart point.
-- 3) One-time delete of historical NULL-score snapshot rows.
-- 4) Reindex the empty, high-churn telegram_link_telemetry_events table to reclaim index bloat.

DROP INDEX IF EXISTS public.idx_creator_coins_chain_creator_rank;
DROP INDEX IF EXISTS public.creator_coins_chain_idx;
DROP INDEX IF EXISTS public.idx_ethos_daily_snapshots_date_creator;
DROP INDEX IF EXISTS public.idx_ethos_daily_snapshots_date_score;
DROP INDEX IF EXISTS public.idx_creator_ethos_projection_score_desc;

CREATE OR REPLACE FUNCTION public.snapshot_creator_ethos_daily()
RETURNS integer
LANGUAGE plpgsql
AS $function$
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
  WHERE ethos_score IS NOT NULL
  ON CONFLICT (snapshot_date, creator_address) DO UPDATE SET
    ethos_score = EXCLUDED.ethos_score,
    ethos_level = EXCLUDED.ethos_level,
    ethos_score_source = EXCLUDED.ethos_score_source,
    market_cap_usd = EXCLUDED.market_cap_usd,
    volume_24h_usd = EXCLUDED.volume_24h_usd;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$;

COMMENT ON FUNCTION public.snapshot_creator_ethos_daily IS 'Daily Ethos snapshot from creator_ethos_projection; scored rows only (ethos_score IS NOT NULL) since 2026-07 optimization.';

DELETE FROM public.creator_ethos_daily_snapshots WHERE ethos_score IS NULL;

REINDEX TABLE public.telegram_link_telemetry_events;
