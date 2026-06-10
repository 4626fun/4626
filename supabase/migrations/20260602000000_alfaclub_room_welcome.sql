-- One-time Hermit room welcome ledger (per room + wallet).

CREATE TABLE IF NOT EXISTS alfaclub.room_welcome_sent (
  room_id         TEXT NOT NULL,
  sender_address  TEXT NOT NULL,
  welcomed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address)
);

ALTER TABLE alfaclub.room_welcome_sent ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'room_welcome_sent'
      AND policyname = 'room_welcome_sent_deny_all'
  ) THEN
    CREATE POLICY room_welcome_sent_deny_all
      ON alfaclub.room_welcome_sent FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS room_welcome_sent_room_idx
  ON alfaclub.room_welcome_sent(room_id, welcomed_at DESC);

COMMENT ON TABLE alfaclub.room_welcome_sent IS
  'Idempotent gate for one-time Agent Hermit welcome messages per AlfaClub room participant.';
