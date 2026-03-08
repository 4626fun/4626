import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getStringQuery, handleOptions, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureCreatorMetricsSchema } from '../../../server/_lib/creatorMetricsSync.js'

type MetricsScope = 'creators'
type SyncStatus = 'idle' | 'running' | 'error'

type MetricsResponse = {
  scope: MetricsScope
  updatedAt: string
  exact: boolean
  syncStatus: SyncStatus
  sync: {
    backfillComplete: boolean
    sampledCreators: number
    lastSyncStartedAt: string | null
    lastSyncFinishedAt: string | null
    lastFullSyncAt: string | null
    syncError: string | null
    driftEstimateTotal: number | null
    driftPct: number | null
  }
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    creatorCoinsFees24hUsd: number | null
    partial: boolean
    sampledCreators: number
  }
}

const METRICS_CACHE_TTL_MS = 5 * 60 * 1000

let metricsCache: { payload: MetricsResponse; cachedAt: number } | null = null
let refreshPromise: Promise<MetricsResponse> | null = null

function parseScope(v: string | null): MetricsScope {
  return v === 'creators' ? 'creators' : 'creators'
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return null
  return n
}

function asIsoString(v: unknown): string | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v : String(v)
  const ms = Date.parse(s)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function parseSyncStatus(v: unknown): SyncStatus {
  const s = typeof v === 'string' ? v : ''
  if (s === 'running' || s === 'error') return s
  return 'idle'
}

async function computeCanonicalMetrics(scope: MetricsScope): Promise<MetricsResponse> {
  const db = await getDb()
  if (!db) {
    return {
      scope,
      updatedAt: new Date().toISOString(),
      exact: false,
      syncStatus: 'error',
      sync: {
        backfillComplete: false,
        sampledCreators: 0,
        lastSyncStartedAt: null,
        lastSyncFinishedAt: null,
        lastFullSyncAt: null,
        syncError: 'database_not_configured',
        driftEstimateTotal: null,
        driftPct: null,
      },
      totals: {
        creatorsTotal: null,
        creatorsNew24h: null,
        creatorCoinsMarketCapUsd: null,
        creatorCoinsVolume24hUsd: null,
        creatorCoinsFees24hUsd: null,
        partial: true,
        sampledCreators: 0,
      },
    }
  }

  await ensureCreatorMetricsSchema(db)

  const [stateResult, totalsResult] = await Promise.all([
    db.sql`
      SELECT
        backfill_complete,
        sync_status,
        sync_error,
        sampled_creators,
        last_sync_started_at,
        last_sync_finished_at,
        last_full_sync_at,
        drift_estimate_total,
        drift_pct
      FROM creator_metrics_state
      WHERE id = 1
      LIMIT 1;
    `,
    db.sql`
      SELECT
        (SELECT COUNT(*)::BIGINT FROM creators) AS creators_total,
        (
          SELECT COUNT(DISTINCT creator_address)::BIGINT
          FROM creator_coins
          WHERE chain_id = 8453
            AND created_at >= NOW() - INTERVAL '24 hours'
        ) AS creators_new_24h,
        (SELECT COALESCE(SUM(market_cap_usd), 0)::NUMERIC FROM creator_coins WHERE chain_id = 8453) AS market_cap_usd,
        (SELECT COALESCE(SUM(volume_24h_usd), 0)::NUMERIC FROM creator_coins WHERE chain_id = 8453) AS volume_24h_usd,
        (SELECT COALESCE(SUM(fees_24h_usd), 0)::NUMERIC FROM creator_coins WHERE chain_id = 8453) AS fees_24h_usd;
    `,
  ])

  const state = stateResult.rows?.[0] ?? {}
  const agg = totalsResult.rows?.[0] ?? {}
  const syncStatus = parseSyncStatus(state.sync_status)
  const backfillComplete = Boolean(state.backfill_complete)
  const sampledCreators = Math.max(0, Math.floor(toNumber(state.sampled_creators) ?? 0))
  const lastFullSyncAt = asIsoString(state.last_full_sync_at)
  const lastSyncFinishedAt = asIsoString(state.last_sync_finished_at)
  const lastSyncStartedAt = asIsoString(state.last_sync_started_at)
  const syncError = typeof state.sync_error === 'string' && state.sync_error.length > 0 ? state.sync_error : null

  // Canonical totals are considered exact only when backfill completed and no active/error sync.
  const exact = backfillComplete && syncStatus === 'idle'

  const creatorsTotal = toNumber(agg.creators_total)
  const creatorsNew24h = toNumber(agg.creators_new_24h)
  const creatorCoinsMarketCapUsd = toNumber(agg.market_cap_usd)
  const creatorCoinsVolume24hUsd = toNumber(agg.volume_24h_usd)
  const creatorCoinsFees24hUsd = toNumber(agg.fees_24h_usd)

  return {
    scope,
    updatedAt: lastFullSyncAt ?? lastSyncFinishedAt ?? new Date().toISOString(),
    exact,
    syncStatus,
    sync: {
      backfillComplete,
      sampledCreators,
      lastSyncStartedAt,
      lastSyncFinishedAt,
      lastFullSyncAt,
      syncError,
      driftEstimateTotal: toNumber(state.drift_estimate_total),
      driftPct: toNumber(state.drift_pct),
    },
    totals: {
      // Surface best-effort aggregate values even before canonical sync completes.
      creatorsTotal,
      creatorsNew24h,
      creatorCoinsMarketCapUsd,
      creatorCoinsVolume24hUsd,
      creatorCoinsFees24hUsd,
      partial: !exact,
      sampledCreators,
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const scope = parseScope(getStringQuery(req, 'scope'))
  const now = Date.now()
  const cached = metricsCache
  if (cached && now - cached.cachedAt < METRICS_CACHE_TTL_MS) {
    setCache(res, 60)
    return res.status(200).json({ success: true, data: cached.payload })
  }

  const startRefresh = () => {
    if (refreshPromise) return refreshPromise
    refreshPromise = computeCanonicalMetrics(scope)
      .then((payload) => {
      metricsCache = { payload, cachedAt: Date.now() }
      return payload
    })
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  }

  try {
    const refresh = startRefresh()
    if (cached) {
      // Serve stale cache while canonical refresh runs in background.
      setCache(res, 30)
      return res.status(200).json({ success: true, data: cached.payload })
    }

    const fresh = await refresh
    setCache(res, 60)
    return res.status(200).json({ success: true, data: fresh })
  } catch (e: any) {
    if (cached) {
      setCache(res, 15)
      return res.status(200).json({ success: true, data: cached.payload })
    }
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to compute canonical metrics',
    })
  }
}

