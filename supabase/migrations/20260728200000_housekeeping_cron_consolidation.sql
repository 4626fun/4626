-- Housekeeping cron consolidation (2026-07-28)
--
-- Problems fixed:
-- 1) nightly-ephemeral-cleanup inline SQL duplicated agent_rate_limits TTL (7d)
--    vs cleanup_operational_retention default (14d) — pick one owner (7d in ops).
-- 2) auth_nonces / auth_handoffs only purged by the inline job — fold into
--    cleanup_expired_rows() so all expiry paths are versioned.
-- 3) daily-cleanup-legacy-backups and daily-cleanup-operational-retention both
--    ran at 15 4 * * * — stagger.
-- 4) Weekly VACUUM only covered Zora tables; creator_coins is the other hot
--    write path (historically indexes >> heap). Add weekly VACUUM ANALYZE.
-- 5) Sunday vacuums shared the 04:30 window with daily DELETEs — shift later.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) cleanup_expired_rows: add auth_nonces + auth_handoffs (versioned)
-- ---------------------------------------------------------------------------
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
  IF to_regclass('public.deploys') IS NOT NULL THEN
    DELETE FROM public.deploys WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('deploys', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('deploys', 0);
  END IF;

  IF to_regclass('public.telegram_action_tokens') IS NOT NULL THEN
    DELETE FROM public.telegram_action_tokens WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('telegram_action_tokens', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('telegram_action_tokens', 0);
  END IF;

  -- General auth nonces (was only in inline nightly-ephemeral-cleanup).
  IF to_regclass('public.auth_nonces') IS NOT NULL THEN
    DELETE FROM public.auth_nonces WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('auth_nonces', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('auth_nonces', 0);
  END IF;

  IF to_regclass('public.auth_agent_nonces') IS NOT NULL THEN
    DELETE FROM public.auth_agent_nonces WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('auth_agent_nonces', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('auth_agent_nonces', 0);
  END IF;

  -- Cross-context handoff codes (was only in inline nightly-ephemeral-cleanup).
  IF to_regclass('public.auth_handoffs') IS NOT NULL THEN
    DELETE FROM public.auth_handoffs WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('auth_handoffs', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('auth_handoffs', 0);
  END IF;

  IF to_regclass('public.telegram_link_start_token_claims') IS NOT NULL THEN
    DELETE FROM public.telegram_link_start_token_claims WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('telegram_link_start_token_claims', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('telegram_link_start_token_claims', 0);
  END IF;

  IF to_regclass('public.telegram_miniapp_replay_nonces') IS NOT NULL THEN
    DELETE FROM public.telegram_miniapp_replay_nonces WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('telegram_miniapp_replay_nonces', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('telegram_miniapp_replay_nonces', 0);
  END IF;

  IF to_regclass('public.telegram_miniapp_sessions') IS NOT NULL THEN
    DELETE FROM public.telegram_miniapp_sessions WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('telegram_miniapp_sessions', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('telegram_miniapp_sessions', 0);
  END IF;

  IF to_regclass('public.telegram_onboarding_sessions') IS NOT NULL THEN
    DELETE FROM public.telegram_onboarding_sessions WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('telegram_onboarding_sessions', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('telegram_onboarding_sessions', 0);
  END IF;

  IF to_regclass('public.wallet_intelligence_cache') IS NOT NULL THEN
    DELETE FROM public.wallet_intelligence_cache WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_result := v_result || jsonb_build_object('wallet_intelligence_cache', v_deleted);
  ELSE
    v_result := v_result || jsonb_build_object('wallet_intelligence_cache', 0);
  END IF;

  RETURN v_result || jsonb_build_object('ran_at', now());
END;
$function$;

COMMENT ON FUNCTION public.cleanup_expired_rows() IS
'Purge rows past expires_at: deploys, telegram tokens/sessions, auth_nonces, auth_agent_nonces, auth_handoffs, wallet_intelligence_cache.';

REVOKE ALL ON FUNCTION public.cleanup_expired_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rows() TO postgres;

-- ---------------------------------------------------------------------------
-- 2) cleanup_operational_retention: agent_rate_limits default 7d (was 14d)
--    Matches former inline nightly policy; single owner of the TTL.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean, integer, integer
);

CREATE OR REPLACE FUNCTION public.cleanup_operational_retention(
  p_agent_rate_limits_days integer DEFAULT 7,
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
'Daily operational retention. agent_rate_limits default 7d (single owner; replaces inline nightly-ephemeral-cleanup). Also: terminal keeper_jobs, control_plane_*, index_usage_snapshots, backtest_market_bars_1m, unmapped ethos_userkey_scores.';

REVOKE ALL ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_operational_retention(
  integer, integer, integer, integer, integer, boolean, integer, integer
) TO postgres;

-- ---------------------------------------------------------------------------
-- 3) Reschedule crons: drop inline ephemeral job, stagger dailies, vacuums
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_jobid bigint;
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed; skip schedule changes';
    RETURN;
  END IF;

  -- Remove every job we manage (recreate with final schedules below).
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'nightly-ephemeral-cleanup',
      'daily-cleanup-expired-rows',
      'daily-cleanup-log-retention',
      'daily-cleanup-operational-retention',
      'daily-cleanup-marketing-analytics',
      'daily-cleanup-legacy-backups',
      'weekly-zora-vacuum-owners',
      'weekly-zora-vacuum-owner-class',
      'weekly-creator-coins-vacuum'
    )
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'unscheduled %', r.jobname;
  END LOOP;

  -- Daily (UTC), staggered:
  -- 03:00 expired TTL tables (incl. auth_nonces / auth_handoffs)
  PERFORM cron.schedule(
    'daily-cleanup-expired-rows',
    '0 3 * * *',
    'SELECT public.cleanup_expired_rows();'
  );

  -- 03:20 log / telemetry retention
  PERFORM cron.schedule(
    'daily-cleanup-log-retention',
    '20 3 * * *',
    'SELECT public.cleanup_log_retention();'
  );

  -- 03:40 operational (rate limits 7d, keeper, control-plane, backtest, ethos)
  PERFORM cron.schedule(
    'daily-cleanup-operational-retention',
    '40 3 * * *',
    'SELECT public.cleanup_operational_retention();'
  );

  -- 04:00 marketing analytics
  PERFORM cron.schedule(
    'daily-cleanup-marketing-analytics',
    '0 4 * * *',
    'SELECT public.cleanup_marketing_analytics_retention();'
  );

  -- 04:20 legacy backups last (heavy DELETEs after lighter jobs)
  PERFORM cron.schedule(
    'daily-cleanup-legacy-backups',
    '20 4 * * *',
    'SELECT public.cleanup_legacy_backups();'
  );

  -- Weekly VACUUM ANALYZE after DELETE window (Sunday 05:30+)
  PERFORM cron.schedule(
    'weekly-zora-vacuum-owners',
    '30 5 * * 0',
    'VACUUM ANALYZE public.zora_csw_owners'
  );

  PERFORM cron.schedule(
    'weekly-zora-vacuum-owner-class',
    '40 5 * * 0',
    'VACUUM ANALYZE public.zora_csw_owner_class'
  );

  PERFORM cron.schedule(
    'weekly-creator-coins-vacuum',
    '50 5 * * 0',
    'VACUUM ANALYZE public.creator_coins'
  );
END;
$$;

COMMIT;
