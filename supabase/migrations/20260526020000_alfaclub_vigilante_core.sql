-- Alfaclub vigilante core tables (creators, indexer cursor, runtime secrets, metrics, publications).
-- Extracted from the duplicated runtime bootstrap in frontend/server/_lib/alfaclub/schema.ts
-- and legacy frontend/db mirrors.
--
-- These are now the single source of truth.

-- Tracks FriendKey mints / creator registrations
CREATE TABLE IF NOT EXISTS alfaclub_creators (
  token_id          TEXT PRIMARY KEY,
  creator_address   TEXT NOT NULL,
  minted_at_block   BIGINT NOT NULL,
  minted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staking_pool      TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub_creators ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alfaclub_creators'
      AND policyname = 'alfaclub_creators_deny_all'
  ) THEN
    CREATE POLICY alfaclub_creators_deny_all
      ON alfaclub_creators FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS alfaclub_creators_addr_idx ON alfaclub_creators(creator_address);
CREATE INDEX IF NOT EXISTS alfaclub_creators_block_idx ON alfaclub_creators(minted_at_block);

-- Tracks the last block we scanned for FriendKey transfers
CREATE TABLE IF NOT EXISTS alfaclub_indexer_cursor (
  cursor_key        TEXT PRIMARY KEY,
  last_block        BIGINT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub_indexer_cursor ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alfaclub_indexer_cursor'
      AND policyname = 'alfaclub_indexer_cursor_deny_all'
  ) THEN
    CREATE POLICY alfaclub_indexer_cursor_deny_all
      ON alfaclub_indexer_cursor FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

-- Runtime-rotated short-lived credentials (e.g. AlfaClub chat JWT)
CREATE TABLE IF NOT EXISTS alfaclub_runtime_secret (
  secret_key         TEXT PRIMARY KEY,
  secret_value       TEXT NOT NULL,
  expires_at         TIMESTAMPTZ,
  updated_by         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub_runtime_secret ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alfaclub_runtime_secret'
      AND policyname = 'alfaclub_runtime_secret_deny_all'
  ) THEN
    CREATE POLICY alfaclub_runtime_secret_deny_all
      ON alfaclub_runtime_secret FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

-- Periodic snapshots of creator metrics (used for scoring / radar)
CREATE TABLE IF NOT EXISTS alfaclub_metrics_snapshot (
  snapshot_ts       TIMESTAMPTZ NOT NULL,
  creator_address   TEXT NOT NULL,
  token_id          TEXT NOT NULL,
  total_supply      NUMERIC NOT NULL DEFAULT 0,
  staked_supply     NUMERIC NOT NULL DEFAULT 0,
  pnl_30d_usd       NUMERIC,
  hl_account_value  NUMERIC,
  score             NUMERIC NOT NULL DEFAULT 0,
  rank              INT NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_ts, creator_address)
);

ALTER TABLE alfaclub_metrics_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alfaclub_metrics_snapshot'
      AND policyname = 'alfaclub_metrics_snapshot_deny_all'
  ) THEN
    CREATE POLICY alfaclub_metrics_snapshot_deny_all
      ON alfaclub_metrics_snapshot FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS alfaclub_metrics_ts_idx ON alfaclub_metrics_snapshot(snapshot_ts DESC);
CREATE INDEX IF NOT EXISTS alfaclub_metrics_creator_idx ON alfaclub_metrics_snapshot(creator_address, snapshot_ts DESC);

-- Publications / content posted by the vigilante (scorecards, Lens, ERC8004, etc.)
CREATE TABLE IF NOT EXISTS alfaclub_publications (
  publication_key   TEXT PRIMARY KEY,
  kind              TEXT NOT NULL,
  creator_address   TEXT NOT NULL,
  token_id          TEXT,
  scorecard_cid     TEXT,
  scorecard_uri     TEXT,
  scorecard_hash    TEXT,
  lens_post_id      TEXT,
  erc8004_tx_hash   TEXT,
  erc8004_calldata  TEXT,
  score             NUMERIC,
  rank              INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alfaclub_publications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alfaclub_publications'
      AND policyname = 'alfaclub_publications_deny_all'
  ) THEN
    CREATE POLICY alfaclub_publications_deny_all
      ON alfaclub_publications FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS alfaclub_publications_creator_idx ON alfaclub_publications(creator_address, created_at DESC);
CREATE INDEX IF NOT EXISTS alfaclub_publications_kind_idx ON alfaclub_publications(kind, created_at DESC);

COMMENT ON TABLE alfaclub_creators IS 'FriendKey / creator registrations tracked by the vigilante indexer.';
COMMENT ON TABLE alfaclub_publications IS 'Content and scorecards published by the AlfaClub vigilante agent.';
