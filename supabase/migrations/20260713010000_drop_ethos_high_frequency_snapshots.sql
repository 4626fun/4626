-- Remove high-frequency Ethos snapshot infrastructure.
--
-- Rationale:
-- - hourly + 15min snapshots have grown too large relative to product value.
-- - canonical Ethos charting should rely on creator_ethos_projection, daily snapshots,
--   and mv_ethos_* materialized views.

BEGIN;

-- Unschedule pg_cron jobs for high-frequency snapshot lanes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'hourly-ethos-snapshot',
      'daily-ethos-hourly-prune',
      '15min-ethos-snapshot',
      'daily-ethos-15min-prune'
    );
  END IF;
END
$$;

-- Drop snapshot/prune functions for retired high-frequency lanes.
DROP FUNCTION IF EXISTS public.snapshot_creator_ethos_hourly();
DROP FUNCTION IF EXISTS public.prune_ethos_hourly_snapshots(integer);
DROP FUNCTION IF EXISTS public.snapshot_creator_ethos_15min();
DROP FUNCTION IF EXISTS public.prune_ethos_15min_snapshots(integer);

-- Drop the underlying tables.
DROP TABLE IF EXISTS public.creator_ethos_hourly_snapshots;
DROP TABLE IF EXISTS public.creator_ethos_15min_snapshots;

-- Rebuild health views to reflect canonical structures only.
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
  'Health check for canonical Ethos chart structures (projection, daily snapshots, unified materialized views).';

CREATE OR REPLACE VIEW public.ethos_last_refreshes AS
SELECT
  'daily_snapshot' AS job,
  MAX(snapshot_date) AS last_run
FROM public.creator_ethos_daily_snapshots
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
