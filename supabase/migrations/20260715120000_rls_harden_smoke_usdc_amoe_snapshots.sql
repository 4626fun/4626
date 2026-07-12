-- P0: close live advisor gaps for public tables still missing RLS.
-- Idempotent: safe if amoe_wallet_allowlist_snapshots was already hardened.
-- Server BFF uses DATABASE_URL / service_role and is unaffected by anon/authenticated revoke.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  exposed_tables TEXT[] := ARRAY[
    'amoe_wallet_allowlist_snapshots',
    'shovel_smoke_phase1',
    'shovel_smoke_tip',
    'usdc'
  ];
BEGIN
  FOREACH table_name IN ARRAY exposed_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );

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

COMMIT;
