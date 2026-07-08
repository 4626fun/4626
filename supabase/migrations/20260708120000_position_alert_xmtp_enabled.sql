-- Optional XMTP DM delivery for Hermit position alerts (protocol 4626 agent CSW).

ALTER TABLE alfaclub.position_alert
  ADD COLUMN IF NOT EXISTS xmtp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN alfaclub.position_alert.xmtp_enabled IS
  'When true, cron sends Hyperliquid alert DMs via the protocol 4626 XMTP agent (PROTOCOL_CSW_*).';
