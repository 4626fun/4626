-- Migration 044: schedule bounded Zora owner Ethos projection + health view
--
-- Why
--   Ethos scores are cached in public.ethos_userkey_scores, then projected into
--   public.zora_csw_owner_class for dashboard and outreach reads. We want an
--   ops-light steady-state path that runs inside Supabase without manual scripts.
--
-- What this migration does
--   1) Adds a small wrapper function for bounded projection batches.
--   2) Adds a health view for quick stale/missing coverage checks.
--   3) Schedules a 5-minute pg_cron job when the cron schema is available.
--
-- Notes
--   - Fetching NEW Ethos values into ethos_userkey_scores still depends on the
--     existing API sync path. This migration automates the DB-side projection.
--   - Scheduling is best-effort. If pg_cron is unavailable or restricted, the
--     migration still succeeds and emits a NOTICE.

BEGIN;

CREATE OR REPLACE FUNCTION public.run_zora_owner_ethos_projection(
  p_limit integer DEFAULT 20000
)
RETURNS TABLE(updated_rows integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.backfill_zora_owner_ethos_from_cache(p_limit);
END;
$$;

COMMENT ON FUNCTION public.run_zora_owner_ethos_projection(integer) IS
  'Runs a bounded projection pass from ethos_userkey_scores into zora_csw_owner_class.';

CREATE OR REPLACE VIEW public.v_zora_owner_ethos_sync_health AS
WITH owners AS (
  SELECT
    COUNT(*)::bigint AS total_rows,
    COUNT(*) FILTER (WHERE ethos_score IS NOT NULL)::bigint AS rows_with_score,
    COUNT(*) FILTER (WHERE ethos_score IS NULL)::bigint AS rows_missing_score,
    COUNT(*) FILTER (
      WHERE ethos_score_updated_at IS NOT NULL
        AND ethos_score_updated_at < NOW() - INTERVAL '24 hours'
    )::bigint AS rows_stale_over_24h,
    MAX(ethos_score_updated_at) AS newest_projected_score_at,
    MIN(ethos_score_updated_at) FILTER (WHERE ethos_score_updated_at IS NOT NULL) AS oldest_projected_score_at
  FROM public.zora_csw_owner_class
),
cache AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'matched')::bigint AS matched_cache_rows,
    COUNT(*) FILTER (
      WHERE status = 'matched'
        AND COALESCE(ethos_last_updated_at, fetched_at) < NOW() - INTERVAL '24 hours'
    )::bigint AS matched_cache_stale_over_24h,
    MAX(COALESCE(ethos_last_updated_at, fetched_at)) FILTER (WHERE status = 'matched') AS newest_cache_score_at
  FROM public.ethos_userkey_scores
)
SELECT
  NOW() AS observed_at,
  owners.total_rows,
  owners.rows_with_score,
  owners.rows_missing_score,
  owners.rows_stale_over_24h,
  owners.newest_projected_score_at,
  owners.oldest_projected_score_at,
  cache.matched_cache_rows,
  cache.matched_cache_stale_over_24h,
  cache.newest_cache_score_at
FROM owners
CROSS JOIN cache;

COMMENT ON VIEW public.v_zora_owner_ethos_sync_health IS
  'Single-row operational health snapshot for Zora owner Ethos projection coverage and staleness.';

DO $$
DECLARE
  v_job_name text := 'zora_owner_ethos_projection_5m';
  v_existing_job_id bigint;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema not available; skipping zora owner ethos projection scheduling';
    RETURN;
  END IF;

  BEGIN
    SELECT j.jobid
    INTO v_existing_job_id
    FROM cron.job j
    WHERE j.jobname = v_job_name
    LIMIT 1;

    IF v_existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_existing_job_id);
    END IF;

    PERFORM cron.schedule(
      v_job_name,
      '*/5 * * * *',
      'SELECT public.run_zora_owner_ethos_projection(20000);'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'unable to schedule %: %', v_job_name, SQLERRM;
  END;
END $$;

COMMIT;
