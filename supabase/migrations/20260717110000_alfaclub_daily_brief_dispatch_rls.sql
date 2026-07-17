-- Deny-all RLS on daily_brief_dispatch (same pattern as radar_dispatch).
-- No FORCE ROW LEVEL SECURITY: table owner / DATABASE_URL cron via getDb() must keep working.

ALTER TABLE alfaclub.daily_brief_dispatch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'daily_brief_dispatch'
      AND policyname = 'daily_brief_dispatch_deny_all'
  ) THEN
    CREATE POLICY daily_brief_dispatch_deny_all
      ON alfaclub.daily_brief_dispatch FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE alfaclub.daily_brief_dispatch IS
  'Tracks sent daily brief messages per room/snapshot to avoid duplicates in AlfaClub. RLS deny-all for public; owner/cron via getDb() bypasses RLS without FORCE.';
