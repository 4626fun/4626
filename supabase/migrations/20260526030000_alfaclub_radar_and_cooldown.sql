-- Alfaclub radar dispatch dedupe + hermit command cooldown tables.
-- Extracted from runtime bootstrap duplication.

-- Dedupe ledger for Telegram radar digests
CREATE TABLE IF NOT EXISTS alfaclub.radar_dispatch (
  dispatch_key          TEXT PRIMARY KEY,
  snapshot_ts           TIMESTAMPTZ NOT NULL,
  previous_snapshot_ts  TIMESTAMPTZ,
  chat_id               TEXT NOT NULL,
  message_hash          TEXT NOT NULL,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub.radar_dispatch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'radar_dispatch'
      AND policyname = 'radar_dispatch_deny_all'
  ) THEN
    CREATE POLICY radar_dispatch_deny_all
      ON alfaclub.radar_dispatch FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS radar_dispatch_snapshot_idx ON alfaclub.radar_dispatch(snapshot_ts DESC);

-- Per-(room, sender) throttle for creative slash commands
CREATE TABLE IF NOT EXISTS alfaclub.hermit_command_cooldown (
  room_id           TEXT NOT NULL,
  sender_address    TEXT NOT NULL,
  command_key       TEXT NOT NULL,
  last_invoked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address, command_key)
);

ALTER TABLE alfaclub.hermit_command_cooldown ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'hermit_command_cooldown'
      AND policyname = 'hermit_command_cooldown_deny_all'
  ) THEN
    CREATE POLICY hermit_command_cooldown_deny_all
      ON alfaclub.hermit_command_cooldown FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE alfaclub.radar_dispatch IS 'Dedupes scheduled radar digests sent to Telegram channels.';
COMMENT ON TABLE alfaclub.hermit_command_cooldown IS 'Rate limiting for creative Hermit commands per user per room.';
