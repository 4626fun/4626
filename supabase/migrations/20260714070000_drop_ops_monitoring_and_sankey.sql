-- Retire cold ops-only monitoring artifacts (July 2026 audit).
--
-- index_usage_snapshots + capture/drop-candidate functions: manual Phase 6 tooling,
-- zero automated callers, zero rows in production.
-- sankey_lookerstudio_full_dataset: Looker export table with no app/runtime refs.

BEGIN;

DROP FUNCTION IF EXISTS public.index_drop_migration_draft(integer, integer, bigint);
DROP FUNCTION IF EXISTS public.index_drop_candidates(integer, integer, bigint);
DROP FUNCTION IF EXISTS public.capture_index_usage_snapshot();

DROP TABLE IF EXISTS public.index_usage_snapshots CASCADE;
DROP TABLE IF EXISTS public.sankey_lookerstudio_full_dataset CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_operational_retention(
  p_agent_rate_limits_days integer DEFAULT 14,
  p_keeper_jobs_succeeded_days integer DEFAULT 30,
  p_keeper_jobs_failed_days integer DEFAULT 90,
  p_control_plane_terminal_days integer DEFAULT 90,
  -- Deprecated: index_usage_snapshots dropped 2026-07. No-op for call-site compatibility.
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

  v_result := v_result || jsonb_build_object('index_usage_snapshots', 0);

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
'Daily operational retention: agent_rate_limits, terminal keeper_jobs, terminal control_plane_operations, and unmapped ethos_userkey_scores. p_index_usage_snapshots_days is a deprecated no-op (table dropped 2026-07).';

REVOKE ALL ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean
) TO postgres;

COMMIT;
