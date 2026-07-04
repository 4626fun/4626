/**
 * Backfill wallet_directory display_name + avatar_url from Ethos profiles.
 *
 * Usage (from `frontend/` with DATABASE_URL):
 *   pnpm exec tsx scripts/backfill-chat-directory-profiles.ts
 *
 * Env:
 *   CHAT_DIRECTORY_BACKFILL_BATCH_SIZE=50
 *   CHAT_DIRECTORY_BACKFILL_MAX_BATCHES=100
 *   CHAT_DIRECTORY_BACKFILL_SLEEP_MS=200
 */
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { getCachedEthosProfileByUserkey } from '../server/_lib/chat/ethosClient.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? '')
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchBatch(db: Db, limit: number): Promise<Array<{ canonical_wallet: string; ethos_userkey: string }>> {
  const res = await db.sql`
    SELECT canonical_wallet, ethos_userkey
    FROM wallet_directory
    WHERE ethos_userkey IS NOT NULL
      AND (display_name IS NULL OR avatar_url IS NULL)
    ORDER BY last_seen_at DESC NULLS LAST, updated_at DESC
    LIMIT ${limit};
  `
  return (res.rows ?? []).flatMap((row: any) => {
    const canonical_wallet = typeof row.canonical_wallet === 'string' ? row.canonical_wallet.trim().toLowerCase() : ''
    const ethos_userkey = typeof row.ethos_userkey === 'string' ? row.ethos_userkey.trim() : ''
    if (!canonical_wallet || !ethos_userkey) return []
    return [{ canonical_wallet, ethos_userkey }]
  })
}

async function main(): Promise<void> {
  if (!isDbConfigured()) {
    console.error('DATABASE_URL is not configured')
    process.exit(1)
  }

  const db = await getDb()
  if (!db) {
    console.error('Failed to connect to database')
    process.exit(1)
  }

  const batchSize = readIntEnv('CHAT_DIRECTORY_BACKFILL_BATCH_SIZE', 50, 1, 200)
  const maxBatches = readIntEnv('CHAT_DIRECTORY_BACKFILL_MAX_BATCHES', 100, 1, 10_000)
  const sleepMs = readIntEnv('CHAT_DIRECTORY_BACKFILL_SLEEP_MS', 200, 0, 10_000)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await fetchBatch(db, batchSize)
    if (rows.length === 0) {
      console.log(`Done after ${batch} batches. updated=${updated} skipped=${skipped} failed=${failed}`)
      return
    }

    for (const row of rows) {
      try {
        const profile = await getCachedEthosProfileByUserkey(row.ethos_userkey)
        const displayName = profile?.displayName ?? profile?.username ?? null
        const avatarUrl = profile?.avatarUrl ?? null
        if (!displayName && !avatarUrl) {
          skipped += 1
          continue
        }

        await db.sql`
          UPDATE wallet_directory
          SET
            display_name = COALESCE(display_name, ${displayName}),
            avatar_url = COALESCE(avatar_url, ${avatarUrl}),
            updated_at = NOW()
          WHERE canonical_wallet = ${row.canonical_wallet}
            AND (display_name IS NULL OR avatar_url IS NULL);
        `
        updated += 1
      } catch (error) {
        failed += 1
        console.warn(`Failed ${row.canonical_wallet}:`, error instanceof Error ? error.message : error)
      }
    }

    console.log(`Batch ${batch + 1}: processed=${rows.length} updated=${updated} skipped=${skipped} failed=${failed}`)
    if (sleepMs > 0) await sleep(sleepMs)
  }

  console.log(`Reached max batches. updated=${updated} skipped=${skipped} failed=${failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
