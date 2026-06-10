/**
 * One-off projection refresh (e.g. after wallet backfill final step times out).
 *
 *   pnpm exec tsx scripts/refresh-creator-ethos-projection.ts
 *
 * Env: DATABASE_URL, optional ETHOS_CREATOR_PROJECTION_LIMIT (default 15000).
 */
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { refreshCreatorEthosProjection } from '../server/_lib/zora/creatorEthosProjection.js'

function readLimit(): number {
  const raw = Number(process.env.ETHOS_CREATOR_PROJECTION_LIMIT ?? '')
  if (!Number.isFinite(raw) || raw <= 0) return 15_000
  return Math.max(100, Math.min(250_000, Math.floor(raw)))
}

async function main(): Promise<void> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const limit = readLimit()
  const before = await db.sql`
    SELECT COUNT(*) FILTER (WHERE ethos_score IS NOT NULL) AS scored, COUNT(*) AS total
    FROM public.creator_ethos_projection; -- source of truth for v_explore_creators and all charts
  `
  console.info('[refresh-creator-ethos-projection] start', { limit, before: before.rows?.[0] })

  const result = await refreshCreatorEthosProjection({ db, limit })
  const after = await db.sql`
    SELECT COUNT(*) FILTER (WHERE ethos_score IS NOT NULL) AS scored, COUNT(*) AS total
    FROM public.creator_ethos_projection; -- source of truth for v_explore_creators and all charts
  `
  console.info('[refresh-creator-ethos-projection] done', { result, after: after.rows?.[0] })
}

main().catch((error) => {
  console.error('[refresh-creator-ethos-projection] failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  })
  process.exit(1)
})
