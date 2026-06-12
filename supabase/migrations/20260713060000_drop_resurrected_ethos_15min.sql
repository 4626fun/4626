-- Repair: cold-start schemaBootstrap (ensureEthosChartSupportSchema) re-applied
-- 20260616000000_ethos_15min_snapshots.sql after the 2026-07-13 drop, resurrecting the
-- retired 15-minute snapshot lane (empty table + functions). Drop it again; the code-side
-- fix stops the bootstrap from referencing the retired migration file.
--
-- Note: production instances running pre-fix code may resurrect the empty table once more
-- on cold start until the code change deploys. It receives no writes (the pg_cron jobs are
-- unscheduled), so a follow-up re-run of these drops after deploy is sufficient.
DROP FUNCTION IF EXISTS public.snapshot_creator_ethos_15min();
DROP FUNCTION IF EXISTS public.prune_ethos_15min_snapshots(integer);
DROP TABLE IF EXISTS public.creator_ethos_15min_snapshots;
-- Defensive: same for the hourly lane in case any stale runtime re-applies it.
DROP FUNCTION IF EXISTS public.snapshot_creator_ethos_hourly();
DROP FUNCTION IF EXISTS public.prune_ethos_hourly_snapshots(integer);
DROP TABLE IF EXISTS public.creator_ethos_hourly_snapshots;
