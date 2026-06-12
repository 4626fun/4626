-- Security-advisor cleanup for the surviving Ethos chart objects (post-condensation).
-- All of these are server-only surfaces; nothing should be reachable via PostgREST.

-- 1. creator_ethos_daily_snapshots was created via runtime bootstrap without RLS
--    (ERROR-level rls_disabled_in_public finding). Server connects as postgres and
--    bypasses RLS, so this is purely closing the anon/authenticated REST surface.
ALTER TABLE public.creator_ethos_daily_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creator_ethos_daily_snapshots' AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest" ON public.creator_ethos_daily_snapshots
      AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END $$;

-- 2. Security-definer views -> security invoker (they only aggregate server-only tables).
ALTER VIEW IF EXISTS public.v_ethos_by_creator_age SET (security_invoker = true);
ALTER VIEW IF EXISTS public.ethos_last_refreshes SET (security_invoker = true);
ALTER VIEW IF EXISTS public.ethos_chart_system_health SET (security_invoker = true);

-- 3. Chart materialized views are server-rendered only; drop REST access.
REVOKE SELECT ON public.mv_ethos_level_distribution FROM anon, authenticated;
REVOKE SELECT ON public.mv_ethos_by_source FROM anon, authenticated;
REVOKE SELECT ON public.mv_ethos_by_market_cap_tier FROM anon, authenticated;
REVOKE SELECT ON public.mv_ethos_by_volume_tier FROM anon, authenticated;

-- 4. Pin search_path on the surviving ethos maintenance functions (mutable-search-path warning).
ALTER FUNCTION public.snapshot_creator_ethos_daily() SET search_path = public;
ALTER FUNCTION public.prune_ethos_daily_snapshots(integer) SET search_path = public;
ALTER FUNCTION public.refresh_all_ethos_chart_views() SET search_path = public;

-- 5. cleanup_log_retention is invoked only by pg_cron as the table owner; it must not be
--    callable through /rest/v1/rpc by anon or signed-in users.
REVOKE EXECUTE ON FUNCTION public.cleanup_log_retention(
  integer, integer, integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer, integer, integer, integer
) FROM anon, authenticated;
