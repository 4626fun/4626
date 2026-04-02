-- Schedule daily cleanup jobs for expired rows and log retention.
-- Times are UTC and chosen to run after existing nightly cleanup jobs.

CREATE OR REPLACE FUNCTION public.cleanup_expired_rows()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_deleted bigint := 0;
BEGIN
  DELETE FROM public.deploys
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('deploys', v_deleted);

  DELETE FROM public.telegram_action_tokens
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_action_tokens', v_deleted);

  DELETE FROM public.auth_agent_nonces
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('auth_agent_nonces', v_deleted);

  DELETE FROM public.telegram_link_start_token_claims
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_link_start_token_claims', v_deleted);

  DELETE FROM public.telegram_miniapp_replay_nonces
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_miniapp_replay_nonces', v_deleted);

  DELETE FROM public.telegram_miniapp_sessions
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_miniapp_sessions', v_deleted);

  DELETE FROM public.telegram_onboarding_sessions
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('telegram_onboarding_sessions', v_deleted);

  DELETE FROM public.wallet_intelligence_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_result := v_result || jsonb_build_object('wallet_intelligence_cache', v_deleted);

  RETURN v_result || jsonb_build_object('ran_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_log_retention(
  p_telegram_link_days integer DEFAULT 60,
  p_agent_api_log_days integer DEFAULT 60,
  p_farcaster_rollout_days integer DEFAULT 60,
  p_telegram_funnel_days integer DEFAULT 90,
  p_chat_command_days integer DEFAULT 90
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

  RETURN v_result || jsonb_build_object('ran_at', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rows() TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_log_retention(integer, integer, integer, integer, integer) TO postgres;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'daily-cleanup-expired-rows'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'daily-cleanup-expired-rows',
    '15 3 * * *',
    'select public.cleanup_expired_rows();'
  );

  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'daily-cleanup-log-retention'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'daily-cleanup-log-retention',
    '45 3 * * *',
    'select public.cleanup_log_retention();'
  );
END;
$$;
