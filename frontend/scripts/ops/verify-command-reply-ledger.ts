#!/usr/bin/env tsx
/**
 * Verify alfaclub.command_reply_ledger exists and report recent rows.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-command-reply-ledger.ts
 */

import { getDb } from '../../server/_lib/db/postgres.js'

async function main(): Promise<void> {
  const db = await getDb()
  if (!db) {
    console.error('DATABASE_URL not configured')
    process.exit(2)
  }

  const table = await db.sql`
    SELECT to_regclass('alfaclub.command_reply_ledger')::text AS tbl;
  `
  const tbl = (table.rows?.[0] as { tbl: string | null } | undefined)?.tbl
  if (!tbl) {
    console.error('MISSING: alfaclub.command_reply_ledger — apply supabase/migrations/20260706000000_alfaclub_command_reply_ledger.sql')
    process.exit(1)
  }
  console.log(`OK table=${tbl}`)

  const count = await db.sql`
    SELECT COUNT(*)::int AS n FROM alfaclub.command_reply_ledger;
  `
  console.log(`ledger_rows=${(count.rows?.[0] as { n: number })?.n ?? 0}`)

  const recent = await db.sql`
    SELECT room_id, message_id, command_head, replied_at
    FROM alfaclub.command_reply_ledger
    ORDER BY replied_at DESC
    LIMIT 8;
  `
  for (const row of recent.rows ?? []) {
    console.log(JSON.stringify(row))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
