-- Remove legacy Arena/Subdomain surfaces that are no longer used.
-- Keep a one-time snapshot of Arena watcher rows before dropping.

DO $$
BEGIN
  IF to_regclass('public.telegram_arena_watchers') IS NOT NULL THEN
    CREATE SCHEMA IF NOT EXISTS private;

    IF to_regclass('private.telegram_arena_watchers_backup_20260402') IS NULL THEN
      CREATE TABLE private.telegram_arena_watchers_backup_20260402 AS
      SELECT
        w.*,
        now() AS archived_at
      FROM public.telegram_arena_watchers w;
    END IF;

    DROP TABLE public.telegram_arena_watchers;
  END IF;
END
$$;

DROP TABLE IF EXISTS public.agent_subdomains;
