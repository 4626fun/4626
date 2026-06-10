-- Schedule the new chart-friendly snapshot and prune jobs via pg_cron
-- These keep the time-series and distribution tables fresh for the 137+ charts.

-- 1. Daily snapshot of the projection (run after the main ethos projection refresh)
-- Adjust the schedule as needed. This example runs at 00:15 UTC daily.
SELECT cron.schedule(
  'daily-ethos-snapshot',
  '15 0 * * *',
  $$ SELECT public.snapshot_creator_ethos_daily(); $$
);

-- 2. Weekly prune of old daily snapshots (keeps last 90 days by default)
SELECT cron.schedule(
  'weekly-ethos-snapshot-prune',
  '30 3 * * 0',   -- Every Sunday at 03:30 UTC
  $$ SELECT public.prune_ethos_daily_snapshots(90); $$
);

-- 3. (Optional but recommended) Daily refresh of the distribution table
-- in case the main projection refresh doesn't always run.
SELECT cron.schedule(
  'daily-ethos-distribution-refresh',
  '45 0 * * *',
  $$ SELECT public.refresh_creator_ethos_distribution(); $$
);

-- Verification queries (run these after applying the migration):
-- SELECT * FROM cron.job WHERE jobname LIKE '%ethos%';
-- SELECT * FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%ethos%') ORDER BY start_time DESC LIMIT 20;

-- Hourly snapshot (runs every hour)
SELECT cron.schedule(
  'hourly-ethos-snapshot',
  '15 * * * *',
  $$ SELECT public.snapshot_creator_ethos_hourly(); $$
);

-- Prune old hourly data (keep last 7 days)
SELECT cron.schedule(
  'daily-ethos-hourly-prune',
  '45 4 * * *',
  $$ SELECT public.prune_ethos_hourly_snapshots(168); $$
);

-- 15-minute snapshots (for the most detailed charts)
SELECT cron.schedule(
  '15min-ethos-snapshot',
  '*/15 * * * *',
  $$ SELECT public.snapshot_creator_ethos_15min(); $$
);

-- Prune old 15min data (keep last 48 hours)
SELECT cron.schedule(
  'daily-ethos-15min-prune',
  '15 5 * * *',
  $$ SELECT public.prune_ethos_15min_snapshots(48); $$
);

-- Refresh market cap bucket stats daily (cheap)
SELECT cron.schedule(
  'daily-ethos-market-cap-buckets',
  '0 1 * * *',
  $$ SELECT public.refresh_ethos_market_cap_buckets(); $$
);

-- Refresh additional bucket tables daily
SELECT cron.schedule(
  'daily-ethos-volume-buckets',
  '10 1 * * *',
  $$ SELECT public.refresh_ethos_volume_buckets(); $$
);

SELECT cron.schedule(
  'daily-ethos-age-buckets',
  '20 1 * * *',
  $$ SELECT public.refresh_ethos_age_buckets(); $$
);

-- Refresh all interconnected Ethos chart materialized views (unified approach)
SELECT cron.schedule(
  'daily-ethos-unified-chart-views',
  '5 1 * * *',
  $$ SELECT public.refresh_all_ethos_chart_views(); $$
);

-- Refresh all interconnected materialized views together (the unified approach)
SELECT cron.schedule(
  'daily-ethos-unified-views',
  '5 1 * * *',
  $$ SELECT public.refresh_all_ethos_chart_views(); $$
);
