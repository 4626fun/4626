import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { syncEthosUserkeyScores } from '../server/_lib/identity/ethosCanonicalScores.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

const SYNC_KEY = 'ethos_zora_backfill_v1'
const ADDRESS_RE = /^0x[a-f0-9]{40}$/

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? '')
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const lowered = value.trim().toLowerCase()
  return ADDRESS_RE.test(lowered) ? lowered : null
}

async function readCursor(db: Awaited<ReturnType<typeof getDb>>): Promise<string | null> {
  const result = await db!.sql`
    SELECT cursor_after
    FROM ethos_score_sync_state
    WHERE sync_key = ${SYNC_KEY}
    LIMIT 1;
  `
  const value = result.rows?.[0]?.cursor_after
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Progress denominator only — avoids a full-table COUNT(*) on zora_csw_owners. */
async function estimateZoraCswOwnerRowCount(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<number> {
  const result = await db.sql`
    SELECT COALESCE(NULLIF(c.reltuples, -1), 0)::bigint AS estimate
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'zora_csw_owners';
  `
  const estimate = Number(result.rows?.[0]?.estimate ?? 0)
  return Number.isFinite(estimate) && estimate > 0 ? Math.floor(estimate) : 0
}

async function writeCursor(db: Awaited<ReturnType<typeof getDb>>, cursor: string | null): Promise<void> {
  await db!.sql`
    INSERT INTO ethos_score_sync_state (
      sync_key,
      cursor_after,
      last_synced_at,
      updated_at
    ) VALUES (
      ${SYNC_KEY},
      ${cursor},
      NOW(),
      NOW()
    )
    ON CONFLICT (sync_key) DO UPDATE
    SET
      cursor_after = EXCLUDED.cursor_after,
      last_synced_at = NOW(),
      updated_at = NOW();
  `
}

async function main(): Promise<void> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const rowBatchSize = readIntEnv('ETHOS_ZORA_BACKFILL_ROW_BATCH_SIZE', 5000, 100, 20000)
  const maxBatches = readIntEnv('ETHOS_ZORA_BACKFILL_MAX_BATCHES', 1000000, 1, 1000000)
  const sleepMs = readIntEnv('ETHOS_ZORA_BACKFILL_SLEEP_MS', 0, 0, 10000)

  const estimatedTotalRows = await estimateZoraCswOwnerRowCount(db)
  let cursor = await readCursor(db)
  let processedRows = 0
  let processedAddresses = 0
  let syncedKeys = 0

  console.info('[ethos-zora-backfill] start', {
    estimatedTotalRows,
    rowBatchSize,
    maxBatches,
    resumeCursor: cursor,
  })

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const rowsResult = cursor
      ? await db.sql`
          SELECT csw_address, base_owner, current_owners
          FROM zora_csw_owners
          WHERE csw_address > ${cursor}
          ORDER BY csw_address ASC
          LIMIT ${rowBatchSize};
        `
      : await db.sql`
          SELECT csw_address, base_owner, current_owners
          FROM zora_csw_owners
          ORDER BY csw_address ASC
          LIMIT ${rowBatchSize};
        `

    const rows = (rowsResult.rows ?? []) as Array<{
      csw_address: string
      base_owner: string | null
      current_owners: string[] | null
    }>
    if (rows.length === 0) {
      console.info('[ethos-zora-backfill] complete', {
        estimatedTotalRows,
        processedRows,
        processedAddresses,
        syncedKeys,
        finalCursor: cursor,
      })
      break
    }

    const addresses = new Set<string>()
    for (const row of rows) {
      const csw = normalizeAddress(row.csw_address)
      if (csw) addresses.add(csw)
      const base = normalizeAddress(row.base_owner)
      if (base) addresses.add(base)
      for (const owner of Array.isArray(row.current_owners) ? row.current_owners : []) {
        const normalized = normalizeAddress(owner)
        if (normalized) addresses.add(normalized)
      }
    }

    const forceUserkeys = Array.from(addresses, (address) => `address:${address}`)
    const syncResult = await syncEthosUserkeyScores({
      db,
      forceUserkeys,
      chunkSize: 100,
    })

    processedRows += rows.length
    processedAddresses += addresses.size
    syncedKeys += syncResult.updated
    cursor = rows[rows.length - 1]?.csw_address ?? cursor
    await writeCursor(db, cursor)

    const pct =
      estimatedTotalRows > 0
        ? ((processedRows / estimatedTotalRows) * 100).toFixed(2)
        : 'n/a'
    console.info('[ethos-zora-backfill] batch', {
      batch,
      rows: rows.length,
      addresses: addresses.size,
      attempted: syncResult.attempted,
      updated: syncResult.updated,
      failed: syncResult.failed,
      processedRows,
      estimatedTotalRows,
      progressPctApprox: pct,
      cursor,
    })

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs))
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown_error'
  console.error('[ethos-zora-backfill] failed', { error: message })
  process.exit(1)
})

