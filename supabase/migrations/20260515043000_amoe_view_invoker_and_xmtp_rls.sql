-- Migration: harden AMOE view/table security posture.
--
-- Addresses Supabase linter findings:
--   1) `security_definer_view` on `public.points_amoe_eligible_balance`
--   2) `rls_disabled_in_public` on `public.lottery_amoe_daily_xmtp_checkins`
--
-- Keep this in sync with frontend/db mirror:
--   frontend/db/migrations/041_amoe_view_invoker_and_xmtp_rls.sql

-- Ensure the AMOE eligibility view runs with querying-user privileges.
ALTER VIEW IF EXISTS public.points_amoe_eligible_balance
  SET (security_invoker = true);

-- New AMOE daily task table is server-only; enforce RLS + deny-all policy.
DO $$
BEGIN
  IF to_regclass('public.lottery_amoe_daily_xmtp_checkins') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.lottery_amoe_daily_xmtp_checkins ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "deny_public_rest" ON public.lottery_amoe_daily_xmtp_checkins';
    EXECUTE 'CREATE POLICY "deny_public_rest" ON public.lottery_amoe_daily_xmtp_checkins AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)';
  END IF;
END
$$;
