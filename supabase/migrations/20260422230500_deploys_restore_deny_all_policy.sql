-- Migration: restore deny-all RLS policy on public.deploys.
--
-- Addresses audit finding M-33 (4626-342): `deploys` Table Has Deny Policy
-- Dropped Without Explicit Replacement.
--
-- The earlier migration
--   20260216095709_enable_rls_and_cleanup_public_warnings.sql
-- dropped `drop policy if exists "No public access" on public.deploys;`
-- to clear an advisor "multiple permissive policies" warning, but did
-- not add a replacement policy. On Supabase, a table with RLS enabled
-- and no policies denies all access by default (for roles other than
-- service_role / postgres owner), which is the desired security
-- posture but means the audit-time verification "does the table have
-- at least one active policy?" fails.
--
-- Install an explicit deny-all policy so:
--   1. The table's security posture is visible in schema introspection.
--   2. Any future migration that drops or replaces policies on
--      `deploys` trips a loud DROP POLICY / CREATE POLICY review
--      rather than silently leaving the table policy-less.
--   3. Service-role connections continue to work (they bypass RLS).
--
-- If RLS is somehow not enabled, enable it.

BEGIN;

-- Ensure RLS is enabled (idempotent).
ALTER TABLE IF EXISTS public.deploys ENABLE ROW LEVEL SECURITY;

-- Install an explicit deny-all baseline. Service-role bypasses RLS.
-- Any future "allow X" policy must be ADDED ALONGSIDE this one, not
-- a replacement for it \u2014 Postgres RLS is OR across permissive policies.
DROP POLICY IF EXISTS deploys_deny_all ON public.deploys;
CREATE POLICY deploys_deny_all ON public.deploys
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

COMMIT;
