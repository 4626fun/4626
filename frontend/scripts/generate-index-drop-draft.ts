import { getDb } from '../server/_lib/postgres.ts'

function readNumericFlag(args: string[], flag: string, fallback: number): number {
  const match = args.find((a) => a.startsWith(`${flag}=`))
  if (!match) return fallback
  const raw = match.slice(flag.length + 1).trim()
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

async function main() {
  const args = process.argv.slice(2)
  const minDays = readNumericFlag(args, '--min-days', 14)
  const minSamples = Math.max(1, readNumericFlag(args, '--min-samples', 2))
  const minTableWrites = Math.max(0, readNumericFlag(args, '--min-table-writes', 0))

  const db = await getDb()
  if (!db) {
    console.error('DB is not configured')
    process.exit(1)
  }

  const captured = await db.sql`SELECT public.capture_index_usage_snapshot() AS inserted_count;`
  const insertedCount = Number(captured.rows?.[0]?.inserted_count ?? 0)

  const draft = await db.sql`
    SELECT public.index_drop_migration_draft(${minDays}, ${minSamples}, ${minTableWrites}) AS draft_sql;
  `
  const sql = String(draft.rows?.[0]?.draft_sql ?? '-- no draft returned')

  console.log(`-- captured_index_rows=${insertedCount}`)
  console.log(`-- min_days=${minDays} min_samples=${minSamples} min_table_writes=${minTableWrites}`)
  console.log('')
  console.log(sql)
}

main().catch((err) => {
  console.error('failed_to_generate_index_drop_draft', err)
  process.exit(1)
})
