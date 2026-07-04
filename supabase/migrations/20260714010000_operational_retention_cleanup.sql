-- Operational retention: agent rate limits, keeper job history, control-plane
-- telemetry, index-usage snapshots, and unmapped Ethos score cache rows.
--
-- Context (2026-07 Supabase audit): agent_rate_limits grew ~21k rows in 7 days
-- with no TTL; keeper_jobs and control_plane_* accumulate terminal rows;
-- index_usage_snapshots is ops telemetry only.

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_operational_retention(
  p_agent_rate_limits_days integer DEFAULT 14,
  p_keeper_jobs_succeeded_days integer DEFAULT 30,
  p_keeper_jobs_failed_days integer DEFAULT 90,
  p_control_plane_terminal_days integer DEFAULT 90,
  p_index_usage_snapshots_days integer DEFAULT 90,
  p_prune_unmapped_ethos_userkeys boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_deleted bigint := 0;
BEGIN
  IF to_regclass('public.agent_rate_limits') IS NOT NULL THEN
    DELETE FROM public.agent_rate_limits
    WHERE created_at < now() - make_interval(days => GREATEST(1, p_agent_rate_limits_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('agent_rate_limits', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('agent_rate_limits', 0);
  END IF;

  IF to_regclass('public.keeper_jobs') IS NOT NULL THEN
    DELETE FROM public.keeper_jobs
    WHERE status = 'succeeded'
      AND updated_at < now() - make_interval(days => GREATEST(1, p_keeper_jobs_succeeded_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('keeper_jobs_succeeded', v_deleted);

    DELETE FROM public.keeper_jobs
    WHERE status = 'failed'
      AND updated_at < now() - make_interval(days => GREATEST(1, p_keeper_jobs_failed_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('keeper_jobs_failed', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('keeper_jobs_succeeded', 0, 'keeper_jobs_failed', 0);
  END IF;

  IF to_regclass('public.control_plane_operations') IS NOT NULL THEN
    DELETE FROM public.control_plane_operations
    WHERE status IN ('succeeded', 'failed', 'cancelled', 'expired')
      AND updated_at < now() - make_interval(days => GREATEST(1, p_control_plane_terminal_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('control_plane_operations_terminal', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('control_plane_operations_terminal', 0);
  END IF;

  IF to_regclass('public.index_usage_snapshots') IS NOT NULL THEN
    DELETE FROM public.index_usage_snapshots
    WHERE snapshot_at < now() - make_interval(days => GREATEST(1, p_index_usage_snapshots_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('index_usage_snapshots', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('index_usage_snapshots', 0);
  END IF;

  IF p_prune_unmapped_ethos_userkeys
     AND to_regclass('public.ethos_userkey_scores') IS NOT NULL
     AND to_regclass('public.user_ethos_identity_keys') IS NOT NULL THEN
    DELETE FROM public.ethos_userkey_scores e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_ethos_identity_keys k
      WHERE k.ethos_userkey = e.ethos_userkey
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('ethos_userkey_scores_unmapped', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('ethos_userkey_scores_unmapped', 0);
  END IF;

  RETURN v_result || jsonb_build_object('ran_at', now());
END;
$function$;

COMMENT ON FUNCTION public.cleanup_operational_retention IS
'Daily operational retention: agent_rate_limits, terminal keeper_jobs, terminal control_plane_operations (cascades stages/events), index_usage_snapshots, and unmapped ethos_userkey_scores.';

REVOKE ALL ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean
) TO postgres;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'daily-cleanup-operational-retention'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'daily-cleanup-operational-retention',
    '15 4 * * *',
    'SELECT public.cleanup_operational_retention();'
  );
END;
$$;

COMMIT;
