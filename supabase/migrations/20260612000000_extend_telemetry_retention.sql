-- Extend log retention cleanup to cover high-maintenance telemetry/audit tables
-- identified in the 2026 schema optimization effort.
--
-- These tables have low-to-moderate code surface area but accumulate data
-- with limited long-term business value. We add conservative retention
-- windows (7–90 days) and wire them into the existing daily cron job.

CREATE OR REPLACE FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer DEFAULT 60,
  p_agent_api_log_days integer DEFAULT 60,
  p_farcaster_rollout_days integer DEFAULT 60,
  p_telegram_funnel_days integer DEFAULT 90,
  p_chat_command_days integer DEFAULT 90,

  -- New parameters from telemetry optimization pass (2026-06)
  p_query_temp_io_days          integer DEFAULT 7,
  p_memory_snapshots_days       integer DEFAULT 7,
  p_telegram_funnel_days_v2     integer DEFAULT 14,   -- tighter than legacy
  p_workspace_monitoring_days   integer DEFAULT 7,
  p_episodic_summaries_days     integer DEFAULT 30,
  p_workspace_audit_days        integer DEFAULT 90,
  p_workspace_activity_days     integer DEFAULT 60,
  p_alfaclub_metrics_snapshot_days integer DEFAULT 7,
  p_chat_presence_days          integer DEFAULT 14,
  p_keepr_logs_days             integer DEFAULT 60,
  p_agent_api_logs_days         integer DEFAULT 60,
  p_agent_control_audit_days    integer DEFAULT 90,
  p_telegram_action_audit_days  integer DEFAULT 60
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
  -- Existing cleanups (kept for backward compat)
  DELETE FROM public.telegram_link_telemetry_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_link_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_link_telemetry_events', v_deleted);

  DELETE FROM public.agent_api_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_agent_api_log_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('agent_api_logs', v_deleted);

  DELETE FROM public.farcaster_rollout_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_farcaster_rollout_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('farcaster_rollout_events', v_deleted);

  DELETE FROM public.telegram_funnel_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_funnel_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_funnel_events', v_deleted);

  DELETE FROM public.chat_command_center_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_chat_command_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('chat_command_center_events', v_deleted);

  -- New high-optimization-potential tables (from audit-telemetry-optimization.ts)
  DELETE FROM public.query_temp_io_snapshots
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_query_temp_io_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('query_temp_io_snapshots', v_deleted);

  DELETE FROM public.memory_snapshots
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_memory_snapshots_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('memory_snapshots', v_deleted);

  DELETE FROM public.telegram_funnel_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_funnel_days_v2));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_funnel_events_v2', v_deleted);

  DELETE FROM public.workspace_monitoring_snapshots
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_monitoring_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_monitoring_snapshots', v_deleted);

  DELETE FROM public.episodic_summaries
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_episodic_summaries_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('episodic_summaries', v_deleted);

  DELETE FROM public.workspace_audit_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_audit_logs', v_deleted);

  DELETE FROM public.workspace_activity_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_activity_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_activity_events', v_deleted);

  DELETE FROM public.alfaclub_metrics_snapshot
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_alfaclub_metrics_snapshot_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('alfaclub_metrics_snapshot', v_deleted);

  DELETE FROM public.chat_presence_sessions
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_chat_presence_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('chat_presence_sessions', v_deleted);

  DELETE FROM public.keepr_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_keepr_logs_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('keepr_logs', v_deleted);

  DELETE FROM public.agent_api_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_agent_api_logs_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('agent_api_logs', v_deleted);

  DELETE FROM public.agent_control_audit_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_agent_control_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('agent_control_audit_events', v_deleted);

  DELETE FROM public.telegram_action_audit
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_action_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_action_audit', v_deleted);

  RETURN v_result || jsonb_build_object('ran_at', now());
END;
$function$;

-- Re-grant (idempotent)
REVOKE ALL ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) TO postgres;

-- The existing cron job 'daily-cleanup-log-retention' will automatically pick up the new parameters
-- because it calls the function with no arguments (using defaults). No reschedule needed.