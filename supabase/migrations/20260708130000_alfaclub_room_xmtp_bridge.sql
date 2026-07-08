-- AlfaClub room <-> XMTP group chat bridge (room 1659 initially).
--
-- Loop-prevention ledger: tags each AlfaClub room message that WE posted via a
-- relay (Telegram or XMTP) with its origin channel, so outbound fan-out can skip
-- relaying a message back to the exact channel it came from while still allowing
-- cross-channel propagation (e.g. a Telegram-origin message still reaches XMTP).

CREATE SCHEMA IF NOT EXISTS alfaclub;

CREATE TABLE IF NOT EXISTS alfaclub.chat_bridge_message_origin (
  room_id     TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  origin      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, message_id),
  CONSTRAINT chat_bridge_message_origin_origin_check
    CHECK (origin IN ('telegram', 'xmtp'))
);

ALTER TABLE alfaclub.chat_bridge_message_origin ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'chat_bridge_message_origin'
      AND policyname = 'chat_bridge_message_origin_deny_all'
  ) THEN
    CREATE POLICY chat_bridge_message_origin_deny_all
      ON alfaclub.chat_bridge_message_origin FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

COMMENT ON TABLE alfaclub.chat_bridge_message_origin IS
  'Tags AlfaClub room messages posted by a relay (telegram|xmtp) so outbound fan-out can skip self-echo. See room1659XmtpBridge.ts and chatBridgeMessageOrigin.ts.';
