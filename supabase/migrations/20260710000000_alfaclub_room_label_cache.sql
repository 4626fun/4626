-- Cache canonical AlfaClub room/creator display labels for brief rendering.
-- Source-of-truth can be partial (API scope gaps), so we persist best-known labels.

CREATE TABLE IF NOT EXISTS alfaclub.room_label_cache (
  room_id TEXT PRIMARY KEY,
  creator_address TEXT NOT NULL,
  display_label TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub.room_label_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'room_label_cache'
      AND policyname = 'room_label_cache_deny_all'
  ) THEN
    CREATE POLICY room_label_cache_deny_all
      ON alfaclub.room_label_cache
      AS RESTRICTIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS room_label_cache_creator_address_idx
  ON alfaclub.room_label_cache (creator_address);

CREATE INDEX IF NOT EXISTS room_label_cache_expires_at_idx
  ON alfaclub.room_label_cache (expires_at);

COMMENT ON TABLE alfaclub.room_label_cache IS
  'Best-known room/creator labels used for dynamic brief rendering when upstream sources are partial.';
