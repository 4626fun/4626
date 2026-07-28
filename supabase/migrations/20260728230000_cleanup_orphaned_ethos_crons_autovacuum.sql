-- Cleanup orphaned high-frequency Ethos cron jobs + autovacuum tune (2026-07-28)
--
-- Context:
--   20260713010000 dropped ethos_15min / hourly snapshot tables, but the
--   schedule migration (20260614000000) left jobs pointing at gone functions.
--   Those jobs error every run.
--
--   ethos_userkey_scores: 515 live rows in ~112 MB heap after a 631k-row
--   unmapped prune. Autovacuum scale tightened to 0.02 (matches other hot
--   tables). VACUUM FULL is run out-of-band (cannot run inside a migration
--   transaction).

DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed; skip';
    RETURN;
  END IF;

  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'hourly-ethos-snapshot',
      'daily-ethos-hourly-prune',
      '15min-ethos-snapshot',
      'daily-ethos-15min-prune',
      'daily-ethos-distribution-refresh',
      'daily-ethos-market-cap-buckets',
      'daily-ethos-volume-buckets',
      'daily-ethos-age-buckets',
      'daily-ethos-unified-chart-views',
      'daily-ethos-unified-views'
    )
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'unscheduled orphaned ethos job %', r.jobname;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-ethos-snapshot') THEN
    PERFORM cron.schedule(
      'daily-ethos-snapshot',
      '15 0 * * *',
      'SELECT public.snapshot_creator_ethos_daily();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-ethos-snapshot-prune') THEN
    PERFORM cron.schedule(
      'weekly-ethos-snapshot-prune',
      '30 5 * * 0',
      'SELECT public.prune_ethos_daily_snapshots(90);'
    );
  END IF;
END;
$$;

ALTER TABLE public.ethos_userkey_scores SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 10
);
