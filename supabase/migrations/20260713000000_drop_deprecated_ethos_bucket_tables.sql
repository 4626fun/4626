-- Remove deprecated Ethos bucket/distribution tables/functions.
--
-- These bucket tables were exploratory and explicitly deprecated in
-- 20260624000000_deprecate_separate_bucket_tables.sql.
-- The canonical model is:
-- - creator_ethos_projection (+ snapshots) for source data
-- - mv_ethos_* materialized views for segmented chart reads

BEGIN;

-- Remove obsolete pg_cron jobs targeting deprecated refresh functions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'daily-ethos-distribution-refresh',
      'daily-ethos-market-cap-buckets',
      'daily-ethos-volume-buckets',
      'daily-ethos-age-buckets'
    );
  END IF;
END
$$;

-- Retire obsolete refresh functions first.
DROP FUNCTION IF EXISTS public.refresh_creator_ethos_distribution();
DROP FUNCTION IF EXISTS public.refresh_ethos_market_cap_buckets();
DROP FUNCTION IF EXISTS public.refresh_ethos_volume_buckets();
DROP FUNCTION IF EXISTS public.refresh_ethos_age_buckets();

-- Drop deprecated independent bucket/distribution tables.
DROP TABLE IF EXISTS public.creator_ethos_score_distribution;
DROP TABLE IF EXISTS public.creator_ethos_by_market_cap_bucket;
DROP TABLE IF EXISTS public.creator_ethos_by_volume_bucket;
DROP TABLE IF EXISTS public.creator_ethos_by_age_bucket;

-- Rebuild health views so admin endpoints keep working without deprecated tables.
CREATE OR REPLACE VIEW public.ethos_chart_system_health AS
SELECT
  'creator_ethos_projection' AS table_name,
  (SELECT COUNT(*) FROM public.creator_ethos_projection) AS row_count,
  (SELECT MAX(refreshed_at) FROM public.creator_ethos_projection) AS last_refresh,
  NULL::text AS retention_note
UNION ALL
SELECT
  'creator_ethos_daily_snapshots',
  (SELECT COUNT(*) FROM public.creator_ethos_daily_snapshots),
  (SELECT MAX(snapshot_date) FROM public.creator_ethos_daily_snapshots),
  '90 days'
UNION ALL
SELECT
  'creator_ethos_hourly_snapshots',
  (SELECT COUNT(*) FROM public.creator_ethos_hourly_snapshots),
  (SELECT MAX(snapshot_hour) FROM public.creator_ethos_hourly_snapshots),
  '7 days'
UNION ALL
SELECT
  'creator_ethos_15min_snapshots',
  (SELECT COUNT(*) FROM public.creator_ethos_15min_snapshots),
  (SELECT MAX(snapshot_time) FROM public.creator_ethos_15min_snapshots),
  '48 hours'
UNION ALL
SELECT
  'mv_ethos_level_distribution',
  (SELECT COUNT(*) FROM public.mv_ethos_level_distribution),
  (SELECT MAX(refreshed_at) FROM public.mv_ethos_level_distribution),
  'materialized view'
UNION ALL
SELECT
  'mv_ethos_by_source',
  (SELECT COUNT(*) FROM public.mv_ethos_by_source),
  (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_source),
  'materialized view'
UNION ALL
SELECT
  'mv_ethos_by_market_cap_tier',
  (SELECT COUNT(*) FROM public.mv_ethos_by_market_cap_tier),
  (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_market_cap_tier),
  'materialized view'
UNION ALL
SELECT
  'mv_ethos_by_volume_tier',
  (SELECT COUNT(*) FROM public.mv_ethos_by_volume_tier),
  (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_volume_tier),
  'materialized view';

COMMENT ON VIEW public.ethos_chart_system_health IS
  'Health check for canonical Ethos chart structures (projection, snapshots, and unified materialized views).';

CREATE OR REPLACE VIEW public.ethos_last_refreshes AS
SELECT
  'daily_snapshot' AS job,
  MAX(snapshot_date) AS last_run
FROM public.creator_ethos_daily_snapshots
UNION ALL
SELECT 'hourly_snapshot', MAX(snapshot_hour) FROM public.creator_ethos_hourly_snapshots
UNION ALL
SELECT '15min_snapshot', MAX(snapshot_time) FROM public.creator_ethos_15min_snapshots
UNION ALL
SELECT
  'unified_mv_refresh',
  GREATEST(
    (SELECT MAX(refreshed_at) FROM public.mv_ethos_level_distribution),
    (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_source),
    (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_market_cap_tier),
    (SELECT MAX(refreshed_at) FROM public.mv_ethos_by_volume_tier)
  );

COMMENT ON VIEW public.ethos_last_refreshes IS
  'Last refresh timestamps for canonical Ethos snapshot/materialized-view jobs.';

COMMIT;
