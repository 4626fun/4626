import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getDbForCron, isDbConfigured } from '../../../../packages/server-core/src/index.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { syncEthosScoreUpdates, syncEthosUserkeyScores } from '../../../../server/_lib/identity/ethosCanonicalScores.js'
import { refreshCreatorEthosProjection } from '../../../../server/_lib/zora/creatorEthosProjection.js'

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

const hotProjectionFallbackState = {
  consecutivePipelineSplitStaleTicks: 0,
  lastTriggeredAt: 0,
}

function isEnabled(raw: string | undefined): boolean {
  const normalized = String(raw ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
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
  console.warn('[ethos-canonical-sync-hot] projection_lag', {
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

async function maybeRunProjectionFallback(params: {
  db: Awaited<ReturnType<typeof getDbForCron>>
  lagMeta: ProjectionLagMeta
}): Promise<void> {
  if (!params.db) {
    console.info('[ethos-canonical-sync-hot] projection_fallback:skip', { reason: 'db_unavailable' })
    return
  }

  if (!isEnabled(process.env.ETHOS_PROJECTION_FALLBACK_ENABLED)) {
    hotProjectionFallbackState.consecutivePipelineSplitStaleTicks = 0
    console.info('[ethos-canonical-sync-hot] projection_fallback:skip', { reason: 'disabled' })
    return
  }
  const requiredConsecutive = readInt(process.env.ETHOS_PROJECTION_FALLBACK_CONSECUTIVE_TICKS, 3, 1, 1000)
  const cooldownMs = readInt(process.env.ETHOS_PROJECTION_FALLBACK_COOLDOWN_MIN, 15, 1, 1440) * 60_000
  const now = Date.now()

  if (!params.lagMeta.pipelineSplit) {
    hotProjectionFallbackState.consecutivePipelineSplitStaleTicks = 0
    console.info('[ethos-canonical-sync-hot] projection_fallback:skip', { reason: 'pipeline_not_split' })
    return
  }

  hotProjectionFallbackState.consecutivePipelineSplitStaleTicks += 1

  if (hotProjectionFallbackState.consecutivePipelineSplitStaleTicks < requiredConsecutive) {
    console.info('[ethos-canonical-sync-hot] projection_fallback:skip', {
      reason: 'insufficient_consecutive',
      consecutive: hotProjectionFallbackState.consecutivePipelineSplitStaleTicks,
      requiredConsecutive,
    })
    return
  }

  if (hotProjectionFallbackState.lastTriggeredAt > 0 && now - hotProjectionFallbackState.lastTriggeredAt < cooldownMs) {
    console.info('[ethos-canonical-sync-hot] projection_fallback:skip', {
      reason: 'cooldown_active',
      cooldownMs,
      cooldownRemainingMs: cooldownMs - (now - hotProjectionFallbackState.lastTriggeredAt),
    })
    return
  }

  try {
    const result = await params.db.sql`
      SELECT * FROM public.run_zora_owner_ethos_projection(20000);
    `
    hotProjectionFallbackState.lastTriggeredAt = now
    hotProjectionFallbackState.consecutivePipelineSplitStaleTicks = 0
    console.warn('[ethos-canonical-sync-hot] projection_fallback:triggered', {
      updatedRows: Number(result.rows?.[0]?.updated_rows ?? 0),
      cooldownMs,
      requiredConsecutive,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.warn('[ethos-canonical-sync-hot] projection_fallback:skip', {
      reason: 'query_failed',
      error: message.slice(0, 500),
    })
  }
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

async function collectTopCreatorSocialUserkeys(params: {
  db: NonNullable<Awaited<ReturnType<typeof getDbForCron>>>
  limit: number
}): Promise<string[]> {
  const rows = await params.db.sql`
    WITH candidates AS (
      SELECT DISTINCT
        ('service:x.com:username:' || lower(trim(p.twitter_username))) AS ethos_userkey,
        p.volume_24h_usd
      FROM public.creator_ethos_projection p
      WHERE p.twitter_username IS NOT NULL
        AND trim(p.twitter_username) <> ''
    ),
    stale AS (
      SELECT c.ethos_userkey, c.volume_24h_usd
      FROM candidates c
      LEFT JOIN public.ethos_userkey_scores s
        ON s.ethos_userkey = c.ethos_userkey
      WHERE s.ethos_userkey IS NULL
         OR s.status = 'stale'
         OR s.status = 'unknown'
         OR s.status = 'error'
         OR (s.status = 'matched' AND s.fetched_at < NOW() - INTERVAL '24 hours')
         OR (s.status = 'not_found' AND s.fetched_at < NOW() - INTERVAL '72 hours')
    )
    SELECT ethos_userkey
    FROM stale
    ORDER BY volume_24h_usd DESC NULLS LAST, ethos_userkey ASC
    LIMIT ${params.limit};
  `
  return (rows.rows ?? [])
    .map((row: any) => String(row.ethos_userkey ?? ''))
    .filter((value: string) => value.length > 0)
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

  const updatePageLimit = readInt(process.env.ETHOS_SCORE_UPDATES_PAGE_LIMIT_HOT, 200, 1, 1000)
  const updateMaxPages = readInt(process.env.ETHOS_SCORE_UPDATES_MAX_PAGES_HOT, 2, 1, 20)
  const socialSeedLimit = readInt(process.env.ETHOS_HOT_SOCIAL_USERKEY_SEED_LIMIT, 250, 0, 5000)
  const projectionRefreshLimit = readInt(process.env.ETHOS_CREATOR_PROJECTION_LIMIT_HOT, 2000, 100, 50000)
  const syncBudgetMs = readInt(process.env.ETHOS_HOT_SYNC_BUDGET_MS, 52_000, 5_000, 55_000)
  const startedAtMs = Date.now()
  const remainingMs = () => Math.max(0, syncBudgetMs - (Date.now() - startedAtMs))

  try {
    const updates = await syncEthosScoreUpdates({
      db,
      pageLimit: updatePageLimit,
      maxPages: updateMaxPages,
    })
    const socialUserkeys =
      socialSeedLimit > 0 && remainingMs() > 8_000
        ? await collectTopCreatorSocialUserkeys({
            db,
            limit: socialSeedLimit,
          })
        : []
    const socialSeedSync =
      socialUserkeys.length > 0 && remainingMs() > 5_000
        ? await syncEthosUserkeyScores({
            db,
            forceUserkeys: socialUserkeys,
            chunkSize: 100,
          })
        : { attempted: 0, updated: 0, failed: 0, processedUserkeys: [] as string[] }
    const creatorProjection =
      remainingMs() > 10_000
        ? await refreshCreatorEthosProjection({
            db,
            limit: projectionRefreshLimit,
            mode: 'fast',
          })
        : { refreshedRows: 0, appliedLimit: 0, available: false }
    const health = remainingMs() > 3_000 ? await readProjectionHealth(db) : null
    const lagMeta = emitProjectionLagIfNeeded({ health })
    if (remainingMs() > 15_000) {
      await maybeRunProjectionFallback({ db, lagMeta })
    }
    console.info('[ethos-canonical-sync-hot] tick', {
      updates,
      socialSeedSync: {
        attempted: socialSeedSync.attempted,
        updated: socialSeedSync.updated,
        failed: socialSeedSync.failed,
      },
      creatorProjection,
      health,
      remainingMs: remainingMs(),
    })
    res.status(200).json({
      ok: true,
      updates,
      socialSeedSync: {
        attempted: socialSeedSync.attempted,
        updated: socialSeedSync.updated,
        failed: socialSeedSync.failed,
      },
      creatorProjection,
      health,
      limits: {
        updatePageLimit,
        updateMaxPages,
        socialSeedLimit,
        projectionRefreshLimit,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    const poolSaturated = /timeout exceeded when trying to connect|maxclientsinsessionmode|pool after calling end/i.test(
      message,
    )
    console.warn('[ethos-canonical-sync-hot] failed', { error: message, poolSaturated })
    res.status(poolSaturated ? 503 : 200).json({
      ok: false,
      error: message.slice(0, 500),
    })
  }
}
