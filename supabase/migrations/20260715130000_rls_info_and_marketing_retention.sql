-- P2 follow-ups from Jul 2026 live Supabase review:
-- 1) Close INFO advisor gaps (RLS enabled, no policy)
-- 2) Conservative website_events retention (180d) + daily cron

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'solana_sweep_jobs',
    'creator_strategy_catalog_notes'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'deny_public_rest'
    ) THEN
      EXECUTE format(
        'CREATE POLICY deny_public_rest ON public.%I AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.cleanup_marketing_analytics_retention(
  p_website_event_days integer DEFAULT 180
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF p_website_event_days IS NULL OR p_website_event_days < 30 THEN
    RAISE EXCEPTION 'website_events retention must be at least 30 days';
  END IF;

  IF to_regclass('public.website_events') IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.website_events
  WHERE created_at < now() - make_interval(days => p_website_event_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_marketing_analytics_retention(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_marketing_analytics_retention(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_marketing_analytics_retention(integer) TO postgres;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'daily-cleanup-marketing-analytics'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'daily-cleanup-marketing-analytics',
    '30 4 * * *',
    'SELECT public.cleanup_marketing_analytics_retention();'
  );
END
$$;

COMMIT;
