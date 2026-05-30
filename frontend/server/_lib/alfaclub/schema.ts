/**
 * AlfaClub Vigilante — Supabase schema bootstrap.
 *
 * **Condensed model (per AGENTS.md + docs/operations/supabase-schema-condensation.md):**
 * - `supabase/migrations/` is the single source of truth.
 * - Use `ensureAlfaclubSchema()` (and future extensions in schemaBootstrap.ts) for runtime cold-start needs.
 * - `frontend/db/migrations/` mirrors are legacy; do not duplicate new DDL here or as raw strings.
 *
 * The user_preference + schema creation is now delegated. The remaining tables below are still defined locally (historical bootstrap). They are high-priority candidates for extraction to dedicated supabase/migrations/ files + delegation in a follow-up pass.
 *
 * Follows the same idempotent CREATE-TABLE / RLS-deny pattern as
 * [walletIntelligenceCache.ts](../wallet/walletIntelligenceCache.ts).
 * All tables are private (RLS deny-all) — reads go through the
 * server-side aggregators, never direct client access.
 */

import { getDb } from '../db/postgres.js'
import { ensureAlfaclubSchema } from '../db/schemaBootstrap.js'

let schemaEnsured = false

export async function ensureAlfaClubVigilanteSchema(): Promise<void> {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return
  schemaEnsured = true

  // Canonical condensed path: all core Alfaclub schema now lives in
  // supabase/migrations/ (20260501 + the 20260526 batch).
  await ensureAlfaclubSchema(db)

  // One-time safe migration from the old public.alfaclub_chat_ingest table
  // (can be removed after the migration has run everywhere).
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

  // Additive column extensions that were historically applied in bootstrap
  // (safe on re-run, kept here for environments that may have older rows).
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
