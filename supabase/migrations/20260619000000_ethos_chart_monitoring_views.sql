-- Monitoring views for the Ethos Chart System health

-- 1. Overview of all snapshot table sizes and freshness
CREATE OR REPLACE VIEW public.ethos_chart_system_health AS
SELECT 
  'creator_ethos_projection' as table_name,
  (SELECT COUNT(*) FROM public.creator_ethos_projection) as row_count,
  (SELECT MAX(refreshed_at) FROM public.creator_ethos_projection) as last_refresh,
  NULL as retention_note
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
  'creator_ethos_score_distribution',
  (SELECT COUNT(*) FROM public.creator_ethos_score_distribution),
  (SELECT MAX(last_refreshed_at) FROM public.creator_ethos_score_distribution),
  'live'
UNION ALL
SELECT 
  'creator_ethos_by_market_cap_bucket',
  (SELECT COUNT(*) FROM public.creator_ethos_by_market_cap_bucket),
  (SELECT MAX(last_refreshed_at) FROM public.creator_ethos_by_market_cap_bucket),
  'live';

COMMENT ON VIEW public.ethos_chart_system_health IS 
  'Quick health check for all Ethos chart support tables.';

-- 2. Last refresh times per supporting table
CREATE OR REPLACE VIEW public.ethos_last_refreshes AS
SELECT 
  'distribution' as job,
  MAX(last_refreshed_at) as last_run
FROM public.creator_ethos_score_distribution
UNION ALL
SELECT 'daily_snapshot', MAX(snapshot_date) FROM public.creator_ethos_daily_snapshots
UNION ALL
SELECT 'hourly_snapshot', MAX(snapshot_hour) FROM public.creator_ethos_hourly_snapshots
UNION ALL
SELECT '15min_snapshot', MAX(snapshot_time) FROM public.creator_ethos_15min_snapshots
UNION ALL
SELECT 'market_cap_buckets', MAX(last_refreshed_at) FROM public.creator_ethos_by_market_cap_bucket;

COMMENT ON VIEW public.ethos_last_refreshes IS 
  'Shows the last time each supporting table was refreshed.';
