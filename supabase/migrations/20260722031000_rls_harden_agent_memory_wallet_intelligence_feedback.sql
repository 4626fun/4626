-- Close remaining deny-all RLS gaps on server-only memory/intelligence tables.
-- `wallet_intelligence` is included defensively for older local schemas; the
-- canonical table name is `wallet_intelligence_cache`.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  target_tables TEXT[] := ARRAY[
    'agent_message_memory',
    'episodic_summaries',
    'wallet_intelligence',
    'wallet_intelligence_cache',
    'feedback_index'
  ];
BEGIN
  FOREACH table_name IN ARRAY target_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
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
