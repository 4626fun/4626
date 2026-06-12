-- Drop dead scaffold tables confirmed by the 2026-06 Supabase table audit,
-- and repair cleanup_log_retention (applied live 2026-06-12 as
-- drop_dead_scaffold_tables + fix_cleanup_log_retention_columns).
--
-- Every table below had zero rows in production and zero production code
-- references (only the generated supabase.types.ts or the audit script
-- mention them):
--
-- - message_threads / thread_messages / thread_participants / thread_summaries:
--   abandoned chat-threads scaffold, never shipped.
-- - payment_rail_attempts: scaffold; live payment lanes use payment_orders +
--   payment_events.
-- - base_address_activity_30d: abandoned analytics experiment.
-- - farcaster_rollout_events: never written to; also removed from the
--   cleanup_log_retention function below.
-- - public.alfaclub_chat_ingest: legacy source for the one-time copy into
--   alfaclub.chat_ingest; the copy path in alfaclub/schema.ts is
--   IF-EXISTS-guarded, so dropping is safe.

BEGIN;

-- Children before parents (thread_* reference message_threads where deployed).
DROP TABLE IF EXISTS public.thread_messages CASCADE;
DROP TABLE IF EXISTS public.thread_participants CASCADE;
DROP TABLE IF EXISTS public.thread_summaries CASCADE;
DROP TABLE IF EXISTS public.message_threads CASCADE;

DROP TABLE IF EXISTS public.payment_rail_attempts CASCADE;
DROP TABLE IF EXISTS public.base_address_activity_30d CASCADE;
DROP TABLE IF EXISTS public.farcaster_rollout_events CASCADE;
DROP TABLE IF EXISTS public.alfaclub_chat_ingest CASCADE;

-- Rebuild cleanup_log_retention.
--
-- 1. Drop the legacy 5-arg overload first: CREATE OR REPLACE with the extended
--    parameter list (introduced in 20260612000000) creates a second overload
--    rather than replacing it, which made zero-arg cron calls ambiguous.
-- 2. Remove blocks for dropped tables (farcaster_rollout_events,
--    query_temp_io_snapshots). Their parameters are kept as deprecated no-ops
--    for call-site compatibility.
-- 3. Fix wrong column assumptions in the 20260612000000 body (which had never
--    successfully run live):
--    - alfaclub_metrics_snapshot has snapshot_ts, not created_at.
--    - memory_snapshots / episodic_summaries have no created_at; they hold
--      Eliza agent conversation memory and pruning is intentionally DISABLED
--      (no-op params) rather than silently enabled with a different column.
-- 4. Merge the duplicated agent_api_logs / telegram_funnel_events deletes via
--    LEAST() of their two day parameters.
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
  p_workspace_monitoring_days   integer DEFAULT 7,
  -- Deprecated: agent-memory pruning intentionally disabled. No-op.
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
  -- (Eliza agent memory; never pruned in production). Parameters are no-ops.
  v_result := v_result || jsonb_build_object('memory_snapshots', 0, 'episodic_summaries', 0);

  DELETE FROM public.workspace_monitoring_snapshots
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_monitoring_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_monitoring_snapshots', v_deleted);

  DELETE FROM public.workspace_audit_logs
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_audit_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_audit_logs', v_deleted);

  DELETE FROM public.workspace_activity_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, p_workspace_activity_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('workspace_activity_events', v_deleted);

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
'Daily log/telemetry retention. Deprecated no-op params: p_query_temp_io_days, p_farcaster_rollout_days (tables dropped), p_memory_snapshots_days, p_episodic_summaries_days (agent-memory pruning intentionally disabled).';

COMMIT;
