-- Room-level counter-trade strategy + per-user opt-in state.

CREATE TABLE IF NOT EXISTS alfaclub.counter_trade_room_strategy (
  room_id      TEXT PRIMARY KEY,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  kill_switch  BOOLEAN NOT NULL DEFAULT FALSE,
  global_bias  TEXT NOT NULL DEFAULT 'neutral',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counter_trade_room_strategy_bias_check
    CHECK (global_bias IN ('bullish', 'bearish', 'neutral'))
);

CREATE TABLE IF NOT EXISTS alfaclub.counter_trade_user_opt_in (
  room_id         TEXT NOT NULL,
  sender_address  TEXT NOT NULL,
  state           TEXT NOT NULL DEFAULT 'active',
  preset          TEXT NOT NULL DEFAULT 'balanced',
  pause_reason    TEXT,
  paused_at       TIMESTAMPTZ,
  last_action_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address),
  CONSTRAINT counter_trade_user_opt_in_sender_check
    CHECK (sender_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT counter_trade_user_opt_in_state_check
    CHECK (state IN ('not_opted_in', 'active', 'paused')),
  CONSTRAINT counter_trade_user_opt_in_preset_check
    CHECK (preset IN ('defensive', 'balanced', 'aggressive'))
);

CREATE INDEX IF NOT EXISTS counter_trade_user_opt_in_room_state_idx
  ON alfaclub.counter_trade_user_opt_in (room_id, state);

CREATE TABLE IF NOT EXISTS alfaclub.counter_trade_event_ledger (
  room_id            TEXT NOT NULL,
  sender_address     TEXT NOT NULL,
  event_key          TEXT NOT NULL,
  coin               TEXT,
  user_side          TEXT,
  user_notional_usd  NUMERIC(20, 8),
  event_time_ms      BIGINT NOT NULL,
  raw_event          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address, event_key),
  CONSTRAINT counter_trade_event_sender_check
    CHECK (sender_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT counter_trade_event_side_check
    CHECK (user_side IS NULL OR user_side IN ('long', 'short'))
);

CREATE INDEX IF NOT EXISTS counter_trade_event_ledger_created_idx
  ON alfaclub.counter_trade_event_ledger (created_at DESC);

CREATE TABLE IF NOT EXISTS alfaclub.counter_trade_action_ledger (
  id                  BIGSERIAL PRIMARY KEY,
  room_id             TEXT NOT NULL,
  sender_address      TEXT NOT NULL,
  event_key           TEXT NOT NULL,
  status              TEXT NOT NULL,
  reason              TEXT NOT NULL,
  counter_side        TEXT,
  counter_notional_usd NUMERIC(20, 8),
  counter_leverage    NUMERIC(12, 4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counter_trade_action_sender_check
    CHECK (sender_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT counter_trade_action_status_check
    CHECK (status IN ('executed', 'skipped', 'blocked', 'failed')),
  CONSTRAINT counter_trade_action_side_check
    CHECK (counter_side IS NULL OR counter_side IN ('long', 'short'))
);

CREATE INDEX IF NOT EXISTS counter_trade_action_ledger_room_sender_created_idx
  ON alfaclub.counter_trade_action_ledger (room_id, sender_address, created_at DESC);

ALTER TABLE alfaclub.counter_trade_room_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.counter_trade_user_opt_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.counter_trade_event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE alfaclub.counter_trade_action_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'counter_trade_room_strategy'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.counter_trade_room_strategy
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'counter_trade_user_opt_in'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.counter_trade_user_opt_in
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'counter_trade_event_ledger'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.counter_trade_event_ledger
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'counter_trade_action_ledger'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY deny_public_rest ON alfaclub.counter_trade_action_ledger
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE alfaclub.counter_trade_room_strategy IS
  'Room-level counter-trade strategy controls (enabled, bias, kill switch).';
COMMENT ON TABLE alfaclub.counter_trade_user_opt_in IS
  'Per-user opt-in + preset state for room-level counter-trade automation.';
COMMENT ON TABLE alfaclub.counter_trade_event_ledger IS
  'Deduplicated upstream user trade events used as strategy triggers.';
COMMENT ON TABLE alfaclub.counter_trade_action_ledger IS
  'Counter-trade engine execution decisions and outcomes.';

