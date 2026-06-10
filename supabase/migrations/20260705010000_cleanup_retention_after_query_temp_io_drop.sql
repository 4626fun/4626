-- Post-drop cleanup for the retention function after removing the orphan
-- `query_temp_io_snapshots` (see 20260705000000_drop_orphan_query_temp_io_snapshots.sql).
--
-- - Removes the now-pointless DELETE + result key for the dropped table.
-- - Leaves the function parameter `p_query_temp_io_days` in place (with
--   deprecation comment) so that any existing cron or manual calls that rely
--   on the default signature continue to work without change.
-- - The parameter can be removed in a future coordinated change if we ever
--   do a breaking update to the cleanup function.

CREATE OR REPLACE FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer DEFAULT 60,
  p_agent_api_log_days integer DEFAULT 60,
  p_farcaster_rollout_days integer DEFAULT 60,
  p_telegram_funnel_days integer DEFAULT 90,
  p_chat_command_days integer DEFAULT 90,

  -- Deprecated: table dropped 20260705 (orphan with no writers/producer).
  -- Parameter kept only for signature compatibility with existing cron calls.
  p_query_temp_io_days          integer DEFAULT 7,

  p_memory_snapshots_days       integer DEFAULT 7,
  p_telegram_funnel_days_v2     integer DEFAULT 14,
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

  -- query_temp_io_snapshots block removed — table dropped as confirmed orphan
  -- (see 20260705000000). The parameter above is kept only for call-site compatibility.

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

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.cleanup_log_retention IS
'Daily log/telemetry retention. p_query_temp_io_days parameter is deprecated (table dropped 20260705 as orphan) and kept only for call-site compatibility.';