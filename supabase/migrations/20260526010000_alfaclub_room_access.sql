-- Alfaclub room access gating tables (policies + memberships).
-- Extracted from runtime bootstrap duplication in frontend/server/_lib/alfaclub/schema.ts
-- (and corresponding legacy frontend/db mirrors).
--
-- These power the dynamic creator-coin balance threshold gating for rooms.

CREATE TABLE IF NOT EXISTS alfaclub.room_access_policies (
  room_id                 TEXT PRIMARY KEY,
  token_id                TEXT NOT NULL,
  creator_coin_address    TEXT NOT NULL,
  pool_address            TEXT NOT NULL,
  key_amount_raw          NUMERIC(78, 0) NOT NULL DEFAULT 1,
  enter_threshold_bps     INTEGER NOT NULL DEFAULT 10000,
  exit_threshold_bps      INTEGER NOT NULL DEFAULT 9000,
  grace_hours             INTEGER NOT NULL DEFAULT 24,
  enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by              TEXT,
  updated_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub.room_access_policies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'room_access_policies'
      AND policyname = 'room_access_policies_deny_all'
  ) THEN
    CREATE POLICY room_access_policies_deny_all
      ON alfaclub.room_access_policies FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS room_access_policies_enabled_idx
  ON alfaclub.room_access_policies(enabled, updated_at DESC);

-- Per-wallet room access state machine
CREATE TABLE IF NOT EXISTS alfaclub.room_access_memberships (
  room_id                  TEXT NOT NULL,
  wallet_address           TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'pending',
  creator_coin_balance_raw NUMERIC(78, 0),
  quote_threshold_raw      NUMERIC(78, 0),
  last_checked_at          TIMESTAMPTZ,
  last_eligible_at         TIMESTAMPTZ,
  grace_started_at         TIMESTAMPTZ,
  failure_reason           TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, wallet_address)
);

ALTER TABLE alfaclub.room_access_memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'alfaclub'
      AND tablename = 'room_access_memberships'
      AND policyname = 'room_access_memberships_deny_all'
  ) THEN
    CREATE POLICY room_access_memberships_deny_all
      ON alfaclub.room_access_memberships FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS room_access_memberships_status_idx
  ON alfaclub.room_access_memberships(room_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS room_access_memberships_recheck_idx
  ON alfaclub.room_access_memberships(status, last_checked_at NULLS FIRST);

COMMENT ON TABLE alfaclub.room_access_policies IS
  'Dynamic room gating config based on creator-coin holder balance thresholds (via pool quote).';

COMMENT ON TABLE alfaclub.room_access_memberships IS
  'Per-wallet state machine for room access (pending/active/grace/removed).';
