import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getDbForCron, isDbConfigured } from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  materializeCanonicalEthosScores,
  seedEthosIdentityKeys,
  syncEthosScoreUpdates,
  syncEthosUserkeyScores,
} from '../../../../server/_lib/identity/ethosCanonicalScores.js'
import {
  pickCreatorEthosProjectionRefreshMode,
  refreshCreatorEthosProjection,
} from '../../../../server/_lib/zora/creatorEthosProjection.js'

declare const process: { env: Record<string, string | undefined> }

function readInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function syncEnabled(): boolean {
  const raw = String(process.env.ETHOS_CANONICAL_SCORE_SYNC_ENABLED ?? '').trim().toLowerCase()
  if (!raw) return true
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

type EthosProjectionHealth = {
  observedAt: string | null
  totalRows: number
  rowsWithScore: number
  rowsMissingScore: number
  rowsMissingNoIdentityKey: number
  rowsMissingNoMatchedCache: number
  rowsMissingProjectionGap: number
  rowsStaleOver24h: number
  newestProjectedScoreAt: string | null
  matchedCacheRows: number
  matchedCacheStaleOver24h: number
  newestCacheScoreAt: string | null
  staleSignal: {
    cache: {
      stale: boolean
      thresholdHours: number
      newestCacheAgeHours: number | null
    }
    projection: {
      stale: boolean
      thresholdHours: number
      newestProjectedAgeHours: number | null
      staleRowsOver24h: number
    }
    pipelineSplit: {
      stale: boolean
    }
  }
} | null

type ProjectionLagMeta = {
  staleRatio: number | null
  staleByRatio: boolean
  pipelineSplit: boolean
  projectionStale: boolean
}

function computeProjectionLagMeta(health: EthosProjectionHealth): ProjectionLagMeta {
  if (!health) {
    return {
      staleRatio: null,
      staleByRatio: false,
      pipelineSplit: false,
      projectionStale: false,
    }
  }
  const staleRatio = health.rowsWithScore > 0 ? health.rowsStaleOver24h / health.rowsWithScore : null
  return {
    staleRatio,
    staleByRatio: staleRatio !== null && staleRatio > 0.25,
    pipelineSplit: health.staleSignal.pipelineSplit.stale,
    projectionStale: health.staleSignal.projection.stale,
  }
}

function emitProjectionLagIfNeeded(params: { health: EthosProjectionHealth }): ProjectionLagMeta {
  const meta = computeProjectionLagMeta(params.health)
  if (!meta.pipelineSplit && !meta.projectionStale && !meta.staleByRatio) {
    return meta
  }
  console.warn('[ethos-canonical-sync] projection_lag', {
    reasons: {
      pipelineSplit: meta.pipelineSplit,
      projectionStale: meta.projectionStale,
      staleByRatio: meta.staleByRatio,
    },
    staleRatio: meta.staleRatio === null ? null : Number(meta.staleRatio.toFixed(4)),
    health: params.health,
  })
  return meta
}

async function readProjectionHealth(db: Awaited<ReturnType<typeof getDbForCron>>): Promise<EthosProjectionHealth> {
  if (!db) return null
  try {
    const result = await db.sql`
      SELECT
        observed_at,
        total_rows,
        rows_with_score,
        rows_missing_score,
        rows_missing_no_identity_key,
        rows_missing_no_matched_cache,
        rows_missing_projection_gap,
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
    const cacheThresholdHours = readInt(process.env.ETHOS_SCORE_STALE_ALERT_HOURS, 6, 1, 168)
    const projectionThresholdHours = readInt(process.env.ETHOS_SCORE_PROJECTION_STALE_ALERT_HOURS, 2, 1, 168)
    const newestCacheIso = row.newest_cache_score_at ? new Date(row.newest_cache_score_at).toISOString() : null
    const newestProjectedIso = row.newest_projected_score_at ? new Date(row.newest_projected_score_at).toISOString() : null
    const newestCacheAgeHours = newestCacheIso
      ? Math.max(0, (Date.now() - Date.parse(newestCacheIso)) / (1000 * 60 * 60))
      : null
    const newestProjectedAgeHours = newestProjectedIso
      ? Math.max(0, (Date.now() - Date.parse(newestProjectedIso)) / (1000 * 60 * 60))
      : null
    const projectionStale = newestProjectedAgeHours === null || newestProjectedAgeHours > projectionThresholdHours
    const cacheStale = newestCacheAgeHours === null || newestCacheAgeHours > cacheThresholdHours
    return {
      observedAt: row.observed_at ? new Date(row.observed_at).toISOString() : null,
      totalRows: Number(row.total_rows ?? 0),
      rowsWithScore: Number(row.rows_with_score ?? 0),
      rowsMissingScore: Number(row.rows_missing_score ?? 0),
      rowsMissingNoIdentityKey: Number(row.rows_missing_no_identity_key ?? 0),
      rowsMissingNoMatchedCache: Number(row.rows_missing_no_matched_cache ?? 0),
      rowsMissingProjectionGap: Number(row.rows_missing_projection_gap ?? 0),
      rowsStaleOver24h: Number(row.rows_stale_over_24h ?? 0),
      newestProjectedScoreAt: newestProjectedIso,
      matchedCacheRows: Number(row.matched_cache_rows ?? 0),
      matchedCacheStaleOver24h: Number(row.matched_cache_stale_over_24h ?? 0),
      newestCacheScoreAt: newestCacheIso,
      staleSignal: {
        cache: {
          stale: cacheStale,
          thresholdHours: cacheThresholdHours,
          newestCacheAgeHours: newestCacheAgeHours === null ? null : Number(newestCacheAgeHours.toFixed(2)),
        },
        projection: {
          stale: projectionStale,
          thresholdHours: projectionThresholdHours,
          newestProjectedAgeHours:
            newestProjectedAgeHours === null ? null : Number(newestProjectedAgeHours.toFixed(2)),
          staleRowsOver24h: Number(row.rows_stale_over_24h ?? 0),
        },
        pipelineSplit: {
          stale: !cacheStale && projectionStale,
        },
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

  const db = await getDbForCron()
  if (!db) {
    res.status(503).json({ ok: false, error: 'db_unavailable' })
    return
  }

  const seedLimit = readInt(process.env.ETHOS_SCORE_IDENTITY_SEED_LIMIT, 1000, 1, 10_000)
  const scoreSyncLimit = readInt(process.env.ETHOS_SCORE_SYNC_LIMIT, 1000, 1, 10_000)
  const updatePageLimit = readInt(process.env.ETHOS_SCORE_UPDATES_PAGE_LIMIT, 500, 1, 1000)
  const updateMaxPages = readInt(process.env.ETHOS_SCORE_UPDATES_MAX_PAGES, 5, 1, 20)
  const creatorProjectionLimit = readInt(process.env.ETHOS_CREATOR_PROJECTION_LIMIT, 10_000, 100, 250_000)
  const syncBudgetMs = readInt(process.env.ETHOS_SYNC_BUDGET_MS, 52_000, 5_000, 55_000)
  const startedAtMs = Date.now()
  const remainingMs = () => Math.max(0, syncBudgetMs - (Date.now() - startedAtMs))

  try {
    // Update-driven lane first: keeps hot identities fresh with low latency.
    const updates = await syncEthosScoreUpdates({
      db,
      pageLimit: updatePageLimit,
      maxPages: updateMaxPages,
    })

    // Opportunistic sweep lane: if updates already refreshed many keys, keep the
    // broad pass small to reduce API/db pressure.
    const sweepLimit = updates.refreshedUserkeys > 0
      ? Math.min(scoreSyncLimit, 250)
      : scoreSyncLimit

    const seeded =
      remainingMs() > 20_000
        ? await seedEthosIdentityKeys({
            db,
            limit: seedLimit,
          })
        : { profilesProcessed: 0, keysUpserted: 0, keysDerived: 0 }
    const synced =
      remainingMs() > 12_000
        ? await syncEthosUserkeyScores({
            db,
            limit: sweepLimit,
            chunkSize: 100,
          })
        : { attempted: 0, updated: 0, failed: 0, processedUserkeys: [] as string[] }
    const rollupAfterSync =
      synced.processedUserkeys.length > 0 && remainingMs() > 8_000
        ? await materializeCanonicalEthosScores({
            db,
            userkeys: synced.processedUserkeys,
            limit: sweepLimit,
          })
        : { processed: 0, updated: 0 }
    const projectionMode = pickCreatorEthosProjectionRefreshMode('main')
    const creatorProjection =
      remainingMs() > 10_000
        ? await refreshCreatorEthosProjection({
            db,
            limit: creatorProjectionLimit,
            mode: projectionMode,
          })
        : { refreshedRows: 0, appliedLimit: 0, available: false }
    const health = remainingMs() > 3_000 ? await readProjectionHealth(db) : null
    emitProjectionLagIfNeeded({ health })

    console.info('[ethos-canonical-sync] tick', {
      updates,
      seeded,
      synced,
      rollupAfterSync,
      creatorProjection,
      projectionMode,
      health,
      remainingMs: remainingMs(),
    })

    res.status(200).json({
      ok: true,
      updates,
      seeded,
      synced,
      rollupAfterSync,
      creatorProjection,
      health,
      limits: {
        seedLimit,
        scoreSyncLimit,
        sweepLimit,
        updatePageLimit,
        updateMaxPages,
        creatorProjectionLimit,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.warn('[ethos-canonical-sync] failed', { error: message })
    res.status(200).json({
      ok: false,
      error: message.slice(0, 500),
    })
  }
}
