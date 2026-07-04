-- Extend operational + log retention for dormant telemetry tables identified in
-- the 2026-07 Supabase audit:
--   - backtest_market_bars_1m (~102MB on-demand cache; max backtest window 90d)
--   - control_plane_events / control_plane_stages (stale since 2026-05-31)
-- chat_command_center_events already covered by cleanup_log_retention.

BEGIN;

DROP FUNCTION IF EXISTS public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean
);

CREATE OR REPLACE FUNCTION public.cleanup_operational_retention(
  p_agent_rate_limits_days integer DEFAULT 14,
  p_keeper_jobs_succeeded_days integer DEFAULT 30,
  p_keeper_jobs_failed_days integer DEFAULT 90,
  p_control_plane_terminal_days integer DEFAULT 90,
  p_index_usage_snapshots_days integer DEFAULT 90,
  p_prune_unmapped_ethos_userkeys boolean DEFAULT true,
  p_backtest_bars_days integer DEFAULT 97,
  p_control_plane_orphan_days integer DEFAULT 90
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

  -- Safety net for orphaned lifecycle rows if operations were removed out-of-band.
  IF to_regclass('public.control_plane_events') IS NOT NULL THEN
    DELETE FROM public.control_plane_events
    WHERE created_at < now() - make_interval(days => GREATEST(1, p_control_plane_orphan_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('control_plane_events_orphan', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('control_plane_events_orphan', 0);
  END IF;

  IF to_regclass('public.control_plane_stages') IS NOT NULL THEN
    DELETE FROM public.control_plane_stages
    WHERE created_at < now() - make_interval(days => GREATEST(1, p_control_plane_orphan_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('control_plane_stages_orphan', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('control_plane_stages_orphan', 0);
  END IF;

  IF to_regclass('public.index_usage_snapshots') IS NOT NULL THEN
    DELETE FROM public.index_usage_snapshots
    WHERE snapshot_at < now() - make_interval(days => GREATEST(1, p_index_usage_snapshots_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('index_usage_snapshots', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('index_usage_snapshots', 0);
  END IF;

  IF to_regclass('public.backtest_market_bars_1m') IS NOT NULL THEN
    DELETE FROM public.backtest_market_bars_1m
    WHERE bar_time < now() - make_interval(days => GREATEST(1, p_backtest_bars_days));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('backtest_market_bars_1m', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('backtest_market_bars_1m', 0);
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
'Daily operational retention: agent_rate_limits, terminal keeper_jobs, terminal control_plane_operations (cascades stages/events), orphan control_plane_events/stages, index_usage_snapshots, backtest_market_bars_1m, and unmapped ethos_userkey_scores.';

REVOKE ALL ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean, integer, integer
) TO postgres;

-- One-time purge of pre-retention stale control-plane telemetry (product dormant since 2026-05).
DO $$
DECLARE
  v_deleted bigint := 0;
BEGIN
  IF to_regclass('public.control_plane_events') IS NOT NULL THEN
    DELETE FROM public.control_plane_events
    WHERE created_at < timestamptz '2026-06-01';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'control_plane_events one-time purge: % rows', v_deleted;
  END IF;

  IF to_regclass('public.control_plane_stages') IS NOT NULL THEN
    DELETE FROM public.control_plane_stages
    WHERE created_at < timestamptz '2026-06-01';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'control_plane_stages one-time purge: % rows', v_deleted;
  END IF;

  IF to_regclass('public.control_plane_operations') IS NOT NULL THEN
    DELETE FROM public.control_plane_operations
    WHERE updated_at < timestamptz '2026-06-01'
      AND status IN ('succeeded', 'failed', 'cancelled', 'expired');
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'control_plane_operations one-time purge: % rows', v_deleted;
  END IF;
END;
$$;

COMMIT;
