-- Retire creator workspace tables and remove their cleanup_log_retention blocks.
-- The /api/v1/workspace/* surface and frontend CreatorWorkspacePanel were removed;
-- vault chat and keepr action status no longer write to these tables.

BEGIN;

DROP TABLE IF EXISTS public.workspace_alert_events CASCADE;
DROP TABLE IF EXISTS public.workspace_approvals CASCADE;
DROP TABLE IF EXISTS public.workspace_audit_logs CASCADE;
DROP TABLE IF EXISTS public.workspace_monitoring_snapshots CASCADE;
DROP TABLE IF EXISTS public.workspace_notification_preferences CASCADE;
DROP TABLE IF EXISTS public.workspace_strategy_targets CASCADE;
DROP TABLE IF EXISTS public.workspace_activity_events CASCADE;
DROP TABLE IF EXISTS public.workspace_task_state CASCADE;

DROP FUNCTION IF EXISTS public.cleanup_log_retention(integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer DEFAULT 60,
  p_agent_api_log_days integer DEFAULT 60,
  -- Deprecated: farcaster_rollout_events dropped (dead scaffold). No-op.
  p_farcaster_rollout_days integer DEFAULT 60,
  p_telegram_funnel_days integer DEFAULT 90,
  p_chat_command_days integer DEFAULT 90,
  -- Deprecated: query_temp_io_snapshots dropped (orphan). No-op.
  p_query_temp_io_days          integer DEFAULT 7,
  -- Deprecated: agent-memory pruning intentionally disabled. No-op.
  p_memory_snapshots_days       integer DEFAULT 7,
  p_telegram_funnel_days_v2     integer DEFAULT 14,
  -- Deprecated: workspace_* tables dropped. No-op.
  p_workspace_monitoring_days   integer DEFAULT 7,
  -- Deprecated: agent-memory pruning intentionally disabled. No-op.
  p_episodic_summaries_days     integer DEFAULT 30,
  -- Deprecated: workspace_* tables dropped. No-op.
  p_workspace_audit_days        integer DEFAULT 90,
  -- Deprecated: workspace_* tables dropped. No-op.
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
  DELETE FROM public.telegram_link_telemetry_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_link_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_link_telemetry_events', v_deleted);

  DELETE FROM public.agent_api_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, LEAST(p_agent_api_log_days, p_agent_api_logs_days)));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('agent_api_logs', v_deleted);

  DELETE FROM public.telegram_funnel_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, LEAST(p_telegram_funnel_days, p_telegram_funnel_days_v2)));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_funnel_events', v_deleted);

  DELETE FROM public.chat_command_center_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_chat_command_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('chat_command_center_events', v_deleted);

  -- memory_snapshots / episodic_summaries: pruning intentionally disabled
  v_result := v_result || jsonb_build_object('memory_snapshots', 0, 'episodic_summaries', 0);

  -- workspace_* tables dropped; parameters are no-ops for call-site compatibility.
  v_result := v_result || jsonb_build_object(
    'workspace_monitoring_snapshots', 0,
    'workspace_audit_logs', 0,
    'workspace_activity_events', 0
  );

  DELETE FROM public.alfaclub_metrics_snapshot
  WHERE snapshot_ts < now() - make_interval(days => GREATEST(1, p_alfaclub_metrics_snapshot_days));
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

  DELETE FROM public.agent_control_audit_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_agent_control_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('agent_control_audit_events', v_deleted);

  DELETE FROM public.telegram_action_audit
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_telegram_action_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_action_audit', v_deleted);

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.cleanup_log_retention IS
'Daily log/telemetry retention. Deprecated no-op params: p_query_temp_io_days, p_farcaster_rollout_days (tables dropped), p_memory_snapshots_days, p_episodic_summaries_days (agent-memory pruning disabled), p_workspace_* (workspace tables dropped).';

REVOKE ALL ON FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer,
  p_agent_api_log_days integer,
  p_farcaster_rollout_days integer,
  p_telegram_funnel_days integer,
  p_chat_command_days integer,
  p_query_temp_io_days integer,
  p_memory_snapshots_days integer,
  p_telegram_funnel_days_v2 integer,
  p_workspace_monitoring_days integer,
  p_episodic_summaries_days integer,
  p_workspace_audit_days integer,
  p_workspace_activity_days integer,
  p_alfaclub_metrics_snapshot_days integer,
  p_chat_presence_days integer,
  p_keepr_logs_days integer,
  p_agent_api_logs_days integer,
  p_agent_control_audit_days integer,
  p_telegram_action_audit_days integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer,
  p_agent_api_log_days integer,
  p_farcaster_rollout_days integer,
  p_telegram_funnel_days integer,
  p_chat_command_days integer,
  p_query_temp_io_days integer,
  p_memory_snapshots_days integer,
  p_telegram_funnel_days_v2 integer,
  p_workspace_monitoring_days integer,
  p_episodic_summaries_days integer,
  p_workspace_audit_days integer,
  p_workspace_activity_days integer,
  p_alfaclub_metrics_snapshot_days integer,
  p_chat_presence_days integer,
  p_keepr_logs_days integer,
  p_agent_api_logs_days integer,
  p_agent_control_audit_days integer,
  p_telegram_action_audit_days integer
) TO postgres;

COMMIT;
