import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/db/postgres.js'
import { syncEthosScoreUpdates } from '../../../../server/_lib/identity/ethosCanonicalScores.js'

declare const process: { env: Record<string, string | undefined> }

function readInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function syncEnabled(): boolean {
  const canonicalRaw = String(process.env.ETHOS_CANONICAL_SCORE_SYNC_ENABLED ?? '').trim().toLowerCase()
  if (canonicalRaw && !(canonicalRaw === '1' || canonicalRaw === 'true' || canonicalRaw === 'yes' || canonicalRaw === 'on')) {
    return false
  }
  const hotRaw = String(process.env.ETHOS_CANONICAL_SCORE_HOT_SYNC_ENABLED ?? '').trim().toLowerCase()
  if (!hotRaw) return true
  return hotRaw === '1' || hotRaw === 'true' || hotRaw === 'yes' || hotRaw === 'on'
}

type EthosProjectionHealth = {
  observedAt: string | null
  totalRows: number
  rowsWithScore: number
  rowsMissingScore: number
  rowsStaleOver24h: number
  newestProjectedScoreAt: string | null
  matchedCacheRows: number
  matchedCacheStaleOver24h: number
  newestCacheScoreAt: string | null
  staleSignal: {
    stale: boolean
    thresholdHours: number
    newestCacheAgeHours: number | null
  }
} | null

async function readProjectionHealth(db: Awaited<ReturnType<typeof getDb>>): Promise<EthosProjectionHealth> {
  if (!db) return null
  try {
    const result = await db.sql`
      SELECT
        observed_at,
        total_rows,
        rows_with_score,
        rows_missing_score,
        rows_stale_over_24h,
        newest_projected_score_at,
        matched_cache_rows,
        matched_cache_stale_over_24h,
        newest_cache_score_at
      FROM public.v_zora_owner_ethos_sync_health
      LIMIT 1;
    `
    const row = result.rows?.[0]
    if (!row) return null
    const thresholdHours = readInt(process.env.ETHOS_SCORE_STALE_ALERT_HOURS, 6, 1, 168)
    const newestCacheIso = row.newest_cache_score_at ? new Date(row.newest_cache_score_at).toISOString() : null
    const newestCacheAgeHours = newestCacheIso
      ? Math.max(0, (Date.now() - Date.parse(newestCacheIso)) / (1000 * 60 * 60))
      : null
    return {
      observedAt: row.observed_at ? new Date(row.observed_at).toISOString() : null,
      totalRows: Number(row.total_rows ?? 0),
      rowsWithScore: Number(row.rows_with_score ?? 0),
      rowsMissingScore: Number(row.rows_missing_score ?? 0),
      rowsStaleOver24h: Number(row.rows_stale_over_24h ?? 0),
      newestProjectedScoreAt: row.newest_projected_score_at ? new Date(row.newest_projected_score_at).toISOString() : null,
      matchedCacheRows: Number(row.matched_cache_rows ?? 0),
      matchedCacheStaleOver24h: Number(row.matched_cache_stale_over_24h ?? 0),
      newestCacheScoreAt: newestCacheIso,
      staleSignal: {
        stale: newestCacheAgeHours === null || newestCacheAgeHours > thresholdHours,
        thresholdHours,
        newestCacheAgeHours: newestCacheAgeHours === null ? null : Number(newestCacheAgeHours.toFixed(2)),
      },
    }
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  if (!syncEnabled()) {
    res.status(503).json({ ok: false, error: 'feature_disabled' })
    return
  }
  if (!isAuthorizedCron(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  if (!isDbConfigured()) {
    res.status(503).json({ ok: false, error: 'db_not_configured' })
    return
  }

  const db = await getDb()
  if (!db) {
    res.status(503).json({ ok: false, error: 'db_unavailable' })
    return
  }

  const updatePageLimit = readInt(process.env.ETHOS_SCORE_UPDATES_PAGE_LIMIT_HOT, 200, 1, 1000)
  const updateMaxPages = readInt(process.env.ETHOS_SCORE_UPDATES_MAX_PAGES_HOT, 2, 1, 20)

  try {
    const updates = await syncEthosScoreUpdates({
      db,
      pageLimit: updatePageLimit,
      maxPages: updateMaxPages,
    })
    const health = await readProjectionHealth(db)
    console.info('[ethos-canonical-sync-hot] tick', {
      updates,
      health,
    })
    res.status(200).json({
      ok: true,
      updates,
      health,
      limits: {
        updatePageLimit,
        updateMaxPages,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.warn('[ethos-canonical-sync-hot] failed', { error: message })
    res.status(200).json({
      ok: false,
      error: message.slice(0, 500),
    })
  }
}
