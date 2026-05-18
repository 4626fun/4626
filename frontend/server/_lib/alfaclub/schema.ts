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

  // ── alfaclub_runtime_secret ──
  // Runtime-rotated short-lived credentials (e.g. AlfaClub chat JWT).
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub_runtime_secret (
      secret_key         TEXT PRIMARY KEY,
      secret_value       TEXT NOT NULL,
      expires_at         TIMESTAMPTZ,
      updated_by         TEXT,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub_runtime_secret ENABLE ROW LEVEL SECURITY;`
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
            AND tablename = 'alfaclub_runtime_secret'
            AND policyname = 'alfaclub_runtime_secret_deny_all'
        ) THEN
          CREATE POLICY alfaclub_runtime_secret_deny_all
            ON alfaclub_runtime_secret FOR ALL TO public USING (false) WITH CHECK (false);
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

  // ── alfaclub.chat_ingest ──
  // Live websocket message ingest across all rooms visible to the auth identity.
  await db.sql`CREATE SCHEMA IF NOT EXISTS alfaclub;`
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub.chat_ingest (
      room_id           TEXT NOT NULL,
      message_id        TEXT NOT NULL,
      sender_address    TEXT NOT NULL,
      message_text      TEXT NOT NULL DEFAULT '',
      message_date      TIMESTAMPTZ,
      username          TEXT,
      avatar_url        TEXT,
      is_bot            BOOLEAN,
      is_edited         BOOLEAN,
      edit_deadline     TIMESTAMPTZ,
      deleted_at        TIMESTAMPTZ,
      deleted_by        TEXT,
      deleted_by_username TEXT,
      reply_id          TEXT,
      reply_date        TIMESTAMPTZ,
      reply_text        TEXT,
      reply_sender      TEXT,
      reply_username    TEXT,
      keys_count        INT,
      primary_tag       TEXT,
      primary_tag_variant TEXT,
      attachments_json  JSONB,
      reply_attachments_json JSONB,
      reactions_json    JSONB,
      message_payload_json JSONB,
      source            TEXT NOT NULL DEFAULT 'ws-live',
      raw_payload_text  TEXT,
      ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, message_id)
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub.chat_ingest ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'alfaclub'
            AND tablename = 'chat_ingest'
            AND policyname = 'chat_ingest_deny_all'
        ) THEN
          CREATE POLICY chat_ingest_deny_all
            ON alfaclub.chat_ingest FOR ALL TO public USING (false) WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS chat_ingest_room_date_idx ON alfaclub.chat_ingest(room_id, message_date DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS chat_ingest_ingested_idx ON alfaclub.chat_ingest(ingested_at DESC);`
  try {
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS username TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS avatar_url TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS is_bot BOOLEAN;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS is_edited BOOLEAN;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS edit_deadline TIMESTAMPTZ;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_by TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS deleted_by_username TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_id TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_date TIMESTAMPTZ;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_text TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_sender TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_username TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS keys_count INT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS primary_tag TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS primary_tag_variant TEXT;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS attachments_json JSONB;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reply_attachments_json JSONB;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS reactions_json JSONB;`
    await db.sql`ALTER TABLE alfaclub.chat_ingest ADD COLUMN IF NOT EXISTS message_payload_json JSONB;`
  } catch {
    // Ignore additive column failures in restricted runtime environments.
  }

  // ── alfaclub.radar_dispatch ──
  // Dedupe ledger for Telegram radar digests so scheduled runs do not repost
  // the same snapshot to the same destination.
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub.radar_dispatch (
      dispatch_key          TEXT PRIMARY KEY,
      snapshot_ts           TIMESTAMPTZ NOT NULL,
      previous_snapshot_ts  TIMESTAMPTZ,
      chat_id               TEXT NOT NULL,
      message_hash          TEXT NOT NULL,
      sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub.radar_dispatch ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS radar_dispatch_snapshot_idx ON alfaclub.radar_dispatch(snapshot_ts DESC);`

  // ── alfaclub.user_preference ──
  // Per-(room, sender) chat personalization (e.g. Hermit Spanish dialect).
  // Owned by the Vercel chat-bridge / Hermit lane. NEVER carries auth or
  // session material — see migration 036 / 20260501000000 and
  // [userPreferenceStore.ts](./userPreferenceStore.ts) for the boundary
  // contract.
  await db.sql`
    CREATE TABLE IF NOT EXISTS alfaclub.user_preference (
      room_id           TEXT NOT NULL,
      sender_address    TEXT NOT NULL,
      preference_key    TEXT NOT NULL,
      preference_value  TEXT,
      updated_by        TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, sender_address, preference_key)
    );
  `
  try {
    await db.sql`ALTER TABLE alfaclub.user_preference ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'alfaclub'
            AND tablename = 'user_preference'
            AND policyname = 'user_preference_deny_all'
        ) THEN
          CREATE POLICY user_preference_deny_all
            ON alfaclub.user_preference FOR ALL TO public USING (false) WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS user_preference_sender_idx ON alfaclub.user_preference(sender_address);`

  // ── alfaclub.room_access_policies ──
  // Dynamic room gating policy keyed by AlfaClub room id. Threshold is
  // derived from `quoteBuyKeys(key_amount_raw)` on the configured XYK pool
  // and compared against holder creator-coin balances.
  await db.sql`
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
  `
  try {
    await db.sql`ALTER TABLE alfaclub.room_access_policies ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS room_access_policies_enabled_idx ON alfaclub.room_access_policies(enabled, updated_at DESC);`

  // ── alfaclub.room_access_memberships ──
  // Per-wallet room access state machine: pending -> active -> grace -> removed.
  await db.sql`
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
  `
  try {
    await db.sql`ALTER TABLE alfaclub.room_access_memberships ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore.
  }
  try {
    await db.sql`
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
    `
  } catch {
    // Ignore.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS room_access_memberships_status_idx ON alfaclub.room_access_memberships(room_id, status, updated_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS room_access_memberships_recheck_idx ON alfaclub.room_access_memberships(status, last_checked_at NULLS FIRST);`

  // One-time safe migration from previous public table name.
  try {
    await db.sql`
      DO $$
      BEGIN
        IF to_regclass('public.alfaclub_chat_ingest') IS NOT NULL THEN
          INSERT INTO alfaclub.chat_ingest (
            room_id,
            message_id,
            sender_address,
            message_text,
            message_date,
            source,
            raw_payload_text,
            ingested_at,
            updated_at
          )
          SELECT
            room_id,
            message_id,
            sender_address,
            message_text,
            message_date,
            source,
            raw_payload_text,
            ingested_at,
            updated_at
          FROM public.alfaclub_chat_ingest
          ON CONFLICT (room_id, message_id) DO NOTHING;
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore.
  }

  // ── Drain state columns (additive; safe on re-run) ──
  // Tracks autonomous long-lived submission attempts for 'erc8004-queued'
  // rows. Consumed by [feedbackRelayer.ts](./feedbackRelayer.ts) when the
  // long-lived (Railway) AlfaClub relayer is enabled; production AlfaClub
  // signing now runs on Vercel cron via /api/v1/alfaclub/chat-bridge-run.
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
