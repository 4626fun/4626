-- Close security advisor INFO: RLS enabled with no policies on AlfaClub
-- funding/OI shadow tables. Server-only; deny PostgREST roles explicitly.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'funding_oi_shadow_observation',
    'funding_oi_shadow_outcome'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass(format('alfaclub.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE alfaclub.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE alfaclub.%I FROM anon, authenticated',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'alfaclub'
        AND tablename = table_name
        AND policyname = 'deny_public_rest'
    ) THEN
      EXECUTE format(
        'CREATE POLICY deny_public_rest ON alfaclub.%I AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
