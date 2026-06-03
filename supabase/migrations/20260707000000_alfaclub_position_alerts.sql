-- Per-wallet position alert subscriptions for Hermit / room 1659 (and other Hermit command rooms).
-- Cron runner evaluates Hyperliquid proximity and optionally DMs linked Telegram users.

CREATE TABLE IF NOT EXISTS alfaclub.position_alert (
  room_id                 TEXT NOT NULL,
  sender_address          TEXT NOT NULL,
  enabled                 BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  liquidation_warn_pct    NUMERIC(6, 2),
  target_pnl_usd          NUMERIC(18, 2),
  target_progress_pct     NUMERIC(6, 2) NOT NULL DEFAULT 90,
  last_liq_alert_at       TIMESTAMPTZ,
  last_target_alert_at    TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address)
);

CREATE INDEX IF NOT EXISTS position_alert_enabled_idx
  ON alfaclub.position_alert (enabled)
  WHERE enabled = TRUE;

ALTER TABLE alfaclub.position_alert ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'position_alert'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.position_alert
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE alfaclub.position_alert IS
  'Hermit position alert subscriptions (liquidation proximity + target PnL). Server-only via pooler.';
