#!/usr/bin/env tsx
/**
 * Read-only durable Solana B2 relay state preflight.
 *
 * This command issues SELECTs only. It reports inbox, ingest cursor, receipt,
 * winner-settlement, and one-shot canary authorization state without exposing
 * payloads, bearer secrets, or database connection details.
 */

import { pathToFileURL } from 'node:url'

import { getDb, getDbInitError, type DbPool } from '../../server/_lib/db/postgres.js'

type CountRow = { status: string; count: string | number }

export type SolanaLotteryRelayStateSnapshot = {
  ok: boolean
  databaseConfigured: boolean
  inboxByStatus: CountRow[]
  inboxWithGuidByStatus: CountRow[]
  ingestCursors: Array<{ cursorKey: string; programId: string; lastSignature: string | null; lastSlot: number | null; updatedAt: string }>
  winnerSettlementByStatus: CountRow[]
  canaryAuthorizationsByStatus: CountRow[]
  error?: string
}

function countRows(rows: Array<Record<string, unknown>>): CountRow[] {
  return rows.map((row) => ({
    status: String(row.status ?? 'unknown'),
    count: String(row.count ?? '0'),
  }))
}

export async function readSolanaLotteryRelayState(params?: {
  db?: DbPool | null
}): Promise<SolanaLotteryRelayStateSnapshot> {
  const db = params?.db === undefined ? await getDb() : params.db
  if (!db) {
    return {
      ok: false,
      databaseConfigured: false,
      inboxByStatus: [],
      inboxWithGuidByStatus: [],
      ingestCursors: [],
      winnerSettlementByStatus: [],
      canaryAuthorizationsByStatus: [],
      error: getDbInitError() ?? 'DATABASE_URL unavailable',
    }
  }

  try {
    const [inbox, inboxWithGuid, cursors, winners, canaries] = await Promise.all([
      db.query!('SELECT status, COUNT(*)::text AS count FROM public.solana_lottery_entry_inbox GROUP BY status ORDER BY status'),
      db.query!('SELECT status, COUNT(*)::text AS count FROM public.solana_lottery_entry_inbox WHERE lz_guid IS NOT NULL GROUP BY status ORDER BY status'),
      db.query!('SELECT cursor_key, program_id, last_signature, last_slot, updated_at FROM public.solana_lottery_ingest_cursor ORDER BY updated_at DESC'),
      db.query!('SELECT status, COUNT(*)::text AS count FROM public.solana_lottery_winner_settlement GROUP BY status ORDER BY status'),
      db.query!('SELECT status, COUNT(*)::text AS count FROM public.solana_b2_canary_authorizations GROUP BY status ORDER BY status'),
    ])

    return {
      ok: true,
      databaseConfigured: true,
      inboxByStatus: countRows(inbox.rows ?? []),
      inboxWithGuidByStatus: countRows(inboxWithGuid.rows ?? []),
      ingestCursors: (cursors.rows ?? []).map((row: Record<string, unknown>) => ({
        cursorKey: String(row.cursor_key ?? ''),
        programId: String(row.program_id ?? ''),
        lastSignature: row.last_signature ? String(row.last_signature) : null,
        lastSlot: row.last_slot == null ? null : Number(row.last_slot),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      })),
      winnerSettlementByStatus: countRows(winners.rows ?? []),
      canaryAuthorizationsByStatus: countRows(canaries.rows ?? []),
    }
  } catch (error) {
    return {
      ok: false,
      databaseConfigured: true,
      inboxByStatus: [],
      inboxWithGuidByStatus: [],
      ingestCursors: [],
      winnerSettlementByStatus: [],
      canaryAuthorizationsByStatus: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main(): Promise<void> {
  const result = await readSolanaLotteryRelayState()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
