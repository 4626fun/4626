/**
 * AlfaClub Vigilante — Supabase schema bootstrap.
 *
 * Follows the same idempotent CREATE-TABLE / RLS-deny pattern as
 * [walletIntelligenceCache.ts](../wallet/walletIntelligenceCache.ts).
 * All tables are private (RLS deny-all) — reads go through the
 * server-side aggregators, never direct client access.
 */

import { getDb } from '../db/postgres.js'

let schemaEnsured = false

export async function ensureAlfaClubVigilanteSchema(): Promise<void> {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return
  schemaEnsured = true

  // ── alfaclub_creators ──
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub_creators (
      token_id          TEXT PRIMARY KEY,
      creator_address   TEXT NOT NULL,
      minted_at_block   BIGINT NOT NULL,
      minted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      staking_pool      TEXT,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub_creators ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS cannot be enabled in this runtime.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore if policy creation is unavailable.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_creators_addr_idx ON alfaclub_creators(creator_address);`
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_creators_block_idx ON alfaclub_creators(minted_at_block);`

  // ── alfaclub_indexer_cursor ──
  // Tracks the last block we scanned for FriendKey transfers so cron runs are incremental.
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub_indexer_cursor (
      cursor_key        TEXT PRIMARY KEY,
      last_block        BIGINT NOT NULL,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub_indexer_cursor ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }

  // ── alfaclub_metrics_snapshot ──
  await db.sql`
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
  `
  try {
    await db.sql`ALTER TABLE alfaclub_metrics_snapshot ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_metrics_ts_idx ON alfaclub_metrics_snapshot(snapshot_ts DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_metrics_creator_idx ON alfaclub_metrics_snapshot(creator_address, snapshot_ts DESC);`

  // ── alfaclub_publications ──
  await db.sql`
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
  `
  try {
    await db.sql`ALTER TABLE alfaclub_publications ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_publications_creator_idx ON alfaclub_publications(creator_address, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS alfaclub_publications_kind_idx ON alfaclub_publications(kind, created_at DESC);`

  // ── Drain state columns (additive; safe on re-run) ──
  // Tracks autonomous Railway-side submission attempts for 'erc8004-queued'
  // rows. Consumed by [feedbackRelayer.ts](./feedbackRelayer.ts).
  try {
    await db.sql`ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS submission_attempts INT NOT NULL DEFAULT 0;`
  } catch {
    // Ignore if the column already exists with an incompatible default.
  }
  try {
    await db.sql`ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS last_submission_error TEXT;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`ALTER TABLE alfaclub_publications ADD COLUMN IF NOT EXISTS last_submission_at TIMESTAMPTZ;`
  } catch {
    // Ignore.
  }
}

/** Reset state cache — exposed for tests only. */
export function _resetAlfaClubSchemaCacheForTests(): void {
  schemaEnsured = false
}
