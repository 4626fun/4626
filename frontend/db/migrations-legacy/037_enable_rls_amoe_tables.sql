-- Migration 037: enable RLS + deny-by-default on amoe_* operational tables
--
-- Why
--   Supabase advisor flagged these four tables as having RLS disabled, which
--   means anyone holding the project's anon / publishable key can SELECT,
--   INSERT, UPDATE or DELETE rows directly against the PostgREST endpoint.
--   These tables hold burn-ledger and publisher state for the AMOE flow and
--   are server-only by design — the frontend never reads or writes them
--   under any user identity.
--
-- What this migration does
--   1. Enables row-level security on each of the four tables.
--   2. FORCEs RLS so even table owners are subject to policies (defense in
--      depth — prevents accidental bypass via owner roles in future).
--   3. Adds an explicit deny-all policy for `anon` and `authenticated`
--      roles. This is technically redundant with "RLS on, no permissive
--      policy = denied" but it is documented intent that survives any
--      future "ALTER TABLE … OWNER TO …" or "GRANT … TO authenticated"
--      mistake.
--   4. Leaves `service_role` alone — it has BYPASSRLS by default in
--      Supabase, which is exactly how the existing server handlers
--      (frontend/server/_lib/lottery/amoe*.ts and
--      frontend/api/_handlers/v1/lottery/_amoe*.ts) use these tables via
--      the service-role client.
--
-- Verification before applying
--   - grep'd the entire repo: zero references to these tables under
--     frontend/src/* (i.e., no client-side reads). All references are in
--     server-side handlers that use the service-role client.
--   - Indexer is also clean.
--   - The advisory remediation URL (Supabase docs) recommends exactly this
--     pattern for "operational tables that should never be reachable from
--     client SDKs".
--
-- Rollback
--   ALTER TABLE … DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS … ON …;

BEGIN;

-- amoe_points_burn_ledger (L1 derived ledger written by amoeLedgerProjector)
ALTER TABLE public.amoe_points_burn_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amoe_points_burn_ledger FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amoe_points_burn_ledger_deny_anon ON public.amoe_points_burn_ledger;
CREATE POLICY amoe_points_burn_ledger_deny_anon
  ON public.amoe_points_burn_ledger
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- amoe_points_burn_ledger_snapshots (L2 publisher snapshots)
ALTER TABLE public.amoe_points_burn_ledger_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amoe_points_burn_ledger_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amoe_points_burn_ledger_snapshots_deny_anon ON public.amoe_points_burn_ledger_snapshots;
CREATE POLICY amoe_points_burn_ledger_snapshots_deny_anon
  ON public.amoe_points_burn_ledger_snapshots
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- amoe_publisher_runs (publisher cron lock + audit)
ALTER TABLE public.amoe_publisher_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amoe_publisher_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amoe_publisher_runs_deny_anon ON public.amoe_publisher_runs;
CREATE POLICY amoe_publisher_runs_deny_anon
  ON public.amoe_publisher_runs
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- amoe_burn_credits_intents (forward marker for refund cron scoping)
ALTER TABLE public.amoe_burn_credits_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amoe_burn_credits_intents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amoe_burn_credits_intents_deny_anon ON public.amoe_burn_credits_intents;
CREATE POLICY amoe_burn_credits_intents_deny_anon
  ON public.amoe_burn_credits_intents
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
