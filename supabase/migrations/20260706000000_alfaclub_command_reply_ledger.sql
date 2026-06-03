-- Durable dedupe for AlfaClub chat-bridge slash-command replies.
-- Serverless cron ticks cannot rely on in-memory seenMessageIds or ingest
-- upsert alone — without this ledger, /alfa and /gmeow can replay every minute.

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.command_reply_ledger (
  room_id      TEXT NOT NULL,
  message_id   TEXT NOT NULL,
  command_head TEXT NOT NULL DEFAULT '',
  replied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, message_id)
);

CREATE INDEX IF NOT EXISTS command_reply_ledger_replied_at_idx
  ON alfaclub.command_reply_ledger (replied_at DESC);

ALTER TABLE alfaclub.command_reply_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'command_reply_ledger'
      AND policyname = 'command_reply_ledger_deny_all'
  ) THEN
    CREATE POLICY command_reply_ledger_deny_all
      ON alfaclub.command_reply_ledger FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE alfaclub.command_reply_ledger IS
  'One row per (room, trigger message) after the chat bridge successfully replied. Prevents cron replay spam.';
