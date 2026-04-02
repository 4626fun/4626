-- Auto-expire temporary legacy backup tables after a short retention window.

CREATE OR REPLACE FUNCTION public.cleanup_legacy_backups(
  p_arena_backup_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_table_exists boolean := false;
  v_deleted bigint := 0;
  v_remaining bigint := 0;
BEGIN
  SELECT to_regclass('private.telegram_arena_watchers_backup_20260402') IS NOT NULL
    INTO v_table_exists;

  IF NOT v_table_exists THEN
    RETURN jsonb_build_object(
      'backup_table_exists',
      false,
      'ran_at',
      now()
    );
  END IF;

  DELETE FROM private.telegram_arena_watchers_backup_20260402
  WHERE archived_at < now() - make_interval(days => GREATEST(1, p_arena_backup_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT COUNT(*)::bigint
  INTO v_remaining
  FROM private.telegram_arena_watchers_backup_20260402;

  IF v_remaining = 0 THEN
    DROP TABLE private.telegram_arena_watchers_backup_20260402;
  END IF;

  RETURN jsonb_build_object(
    'backup_table_exists',
    true,
    'rows_deleted',
    v_deleted,
    'rows_remaining',
    v_remaining,
    'table_dropped',
    (v_remaining = 0),
    'retention_days',
    GREATEST(1, p_arena_backup_days),
    'ran_at',
    now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_legacy_backups(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_legacy_backups(integer) TO postgres;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid
  INTO v_jobid
  FROM cron.job
  WHERE jobname = 'daily-cleanup-legacy-backups'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'daily-cleanup-legacy-backups',
    '15 4 * * *',
    'select public.cleanup_legacy_backups();'
  );
END;
$$;
