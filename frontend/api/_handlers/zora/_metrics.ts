import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getStringQuery, handleOptions, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '@4626/server-core'
import {
  cachedTotalsMaxAgeMs,
  ensureCreatorMetricsSchema,
} from '../../../server/_lib/zora/creatorMetricsSync.js'

type MetricsScope = 'creators'
type SyncStatus = 'idle' | 'running' | 'error'

type MetricsResponse = {
  scope: MetricsScope
  updatedAt: string
  exact: boolean
  syncStatus: SyncStatus
  sync: {
    backfillComplete: boolean
    exploreBackfillComplete: boolean
    sampledCreators: number
    lastSyncStartedAt: string | null
    lastSyncFinishedAt: string | null
    lastHotRefreshAt: string | null
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
    ethosScoredCreators: number | null
    ethos1200Creators: number | null
    ethos1600Creators: number | null
    ethos1800Creators: number | null
    partial: boolean
    sampledCreators: number
  }
  history30d: Array<{
    date: string
    creatorCoinsMarketCapUsd: number | null
  }>
}

const METRICS_CACHE_TTL_MS = parsePositiveInt(process.env.ZORA_METRICS_CACHE_TTL_MS, 5 * 60 * 1000)
const STALE_REFRESH_BACKOFF_MS = parsePositiveInt(process.env.ZORA_METRICS_REFRESH_BACKOFF_MS, 60 * 1000)
const STALE_REFRESH_TIMEOUT_BACKOFF_MS = parsePositiveInt(
  process.env.ZORA_METRICS_REFRESH_TIMEOUT_BACKOFF_MS,
  5 * 60 * 1000,
)
const STALE_REFRESH_ERROR_LOG_THROTTLE_MS = parsePositiveInt(
  process.env.ZORA_METRICS_REFRESH_ERROR_LOG_THROTTLE_MS,
  60 * 1000,
)
const SNAPSHOT_WRITE_MIN_INTERVAL_SECONDS = parsePositiveInt(
  process.env.ZORA_METRICS_SNAPSHOT_MIN_UPDATE_SECONDS,
  10 * 60,
)

let metricsCache: { payload: MetricsResponse; cachedAt: number } | null = null
let refreshPromise: Promise<MetricsResponse> | null = null
let staleRefreshBlockedUntilMs = 0
let lastRefreshErrorSignature: string | null = null
let lastRefreshErrorLoggedAtMs = 0

function parseScope(v: string | null): MetricsScope {
  return v === 'creators' ? 'creators' : 'creators'
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function isPoolAcquireTimeoutError(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === 'ETIMEDOUT') return true
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase()
  return msg.includes('timeout exceeded when trying to connect') || msg.includes('timeout acquiring a client')
}

function isDeployDryRunContext(): boolean {
  if (String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim()) return true
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').toLowerCase()
  return deploymentVersion.includes('dryrun')
}

function isLikelyDbConnectivityFailure(err: unknown): boolean {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  if (code === '08006' || code === 'ETIMEDOUT') return true
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('failed to connect to database') ||
    msg.includes('authentication did not complete') ||
    msg.includes('unable to check out connection from the pool')
  )
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

function mapHistoryRows(rows: any[]): Array<{ date: string; creatorCoinsMarketCapUsd: number | null }> {
  return (rows ?? [])
    .map((row) => {
      const dayRaw = typeof row.day === 'string' ? row.day : String(row.day ?? '')
      const dayMs = Date.parse(`${dayRaw}T00:00:00.000Z`)
      if (!Number.isFinite(dayMs)) return null
      return {
        date: new Date(dayMs).toISOString(),
        creatorCoinsMarketCapUsd: toNumber(row.creator_coins_market_cap_usd),
      }
    })
    .filter((entry): entry is { date: string; creatorCoinsMarketCapUsd: number | null } => entry != null)
}

function errorSignature(err: unknown): string {
  const code = String((err as any)?.code ?? '').trim().toUpperCase()
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return `${code}:${msg}`
}

function shouldLogRefreshError(signature: string, now: number): boolean {
  if (!signature) return true
  if (signature !== lastRefreshErrorSignature) {
    lastRefreshErrorSignature = signature
    lastRefreshErrorLoggedAtMs = now
    return true
  }
  if (now - lastRefreshErrorLoggedAtMs >= STALE_REFRESH_ERROR_LOG_THROTTLE_MS) {
    lastRefreshErrorLoggedAtMs = now
    return true
  }
  return false
}

function noteRefreshFailure(err: unknown): void {
  const now = Date.now()
  const backoffMs = isPoolAcquireTimeoutError(err)
    ? STALE_REFRESH_TIMEOUT_BACKOFF_MS
    : STALE_REFRESH_BACKOFF_MS
  staleRefreshBlockedUntilMs = now + backoffMs
  const signature = errorSignature(err)
  if (shouldLogRefreshError(signature, now)) {
    if (isDeployDryRunContext() && isLikelyDbConnectivityFailure(err)) {
      console.info(
        `[zora/metrics] dry-run DB unavailable; skipping background refresh for ${Math.round(backoffMs / 1000)}s`,
      )
    } else {
      console.error('[zora/metrics] background refresh failed', err)
    }
  }
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
        exploreBackfillComplete: false,
        sampledCreators: 0,
        lastSyncStartedAt: null,
        lastSyncFinishedAt: null,
        lastHotRefreshAt: null,
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
        ethosScoredCreators: null,
        ethos1200Creators: null,
        ethos1600Creators: null,
        ethos1800Creators: null,
        partial: true,
        sampledCreators: 0,
      },
      history30d: [],
    }
  }

  await ensureCreatorMetricsSchema(db)

  // Keep these reads sequential: serverless pools often run with max=1, and
  // Promise.all can produce avoidable pool-acquire timeouts under load.
  const stateResult = await db.sql`
    SELECT
      backfill_complete,
      explore_backfill_complete,
      sync_status,
      sync_error,
      sampled_creators,
      last_sync_started_at,
      last_sync_finished_at,
      last_hot_refresh_at,
      last_full_sync_at,
      drift_estimate_total,
      drift_pct,
      cached_creators_total,
      cached_market_cap_usd,
      cached_volume_24h_usd,
      cached_fees_24h_usd,
      cached_totals_at
    FROM creator_metrics_state
    WHERE id = 1
    LIMIT 1;
  `
  const state = stateResult.rows?.[0] ?? {}
  const cachedTotalsAtMs = asIsoString(state.cached_totals_at)
    ? Date.parse(String(state.cached_totals_at))
    : NaN
  const cachedTotalsFresh =
    Number.isFinite(cachedTotalsAtMs) && Date.now() - cachedTotalsAtMs <= cachedTotalsMaxAgeMs()

  const totalsResult = cachedTotalsFresh
    ? {
        rows: [
          {
            creators_total: state.cached_creators_total,
            creators_new_24h: null,
            market_cap_usd: state.cached_market_cap_usd,
            volume_24h_usd: state.cached_volume_24h_usd,
            fees_24h_usd: state.cached_fees_24h_usd,
          },
        ],
      }
    : await db.sql`
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
  `
  if (cachedTotalsFresh) {
    const newCreatorsResult = await db.sql`
      SELECT COUNT(DISTINCT creator_address)::BIGINT AS creators_new_24h
      FROM creator_coins
      WHERE chain_id = 8453
        AND created_at >= NOW() - INTERVAL '24 hours';
    `
    totalsResult.rows[0].creators_new_24h = newCreatorsResult.rows?.[0]?.creators_new_24h ?? null
  }

  const agg = totalsResult.rows?.[0] ?? {}
  const syncStatus = parseSyncStatus(state.sync_status)
  const backfillComplete = Boolean(state.backfill_complete)
  const exploreBackfillComplete = Boolean(state.explore_backfill_complete)
  const sampledCreators = Math.max(0, Math.floor(toNumber(state.sampled_creators) ?? 0))
  const lastFullSyncAt = asIsoString(state.last_full_sync_at)
  const lastSyncFinishedAt = asIsoString(state.last_sync_finished_at)
  const lastSyncStartedAt = asIsoString(state.last_sync_started_at)
  const lastHotRefreshAt = asIsoString(state.last_hot_refresh_at)
  const syncError = typeof state.sync_error === 'string' && state.sync_error.length > 0 ? state.sync_error : null

  // Canonical totals are considered exact only when backfill completed and no active/error sync.
  const exact = backfillComplete && syncStatus === 'idle'

  const creatorsTotal = toNumber(agg.creators_total)
  const creatorsNew24h = toNumber(agg.creators_new_24h)
  const creatorCoinsMarketCapUsd = toNumber(agg.market_cap_usd)
  const creatorCoinsVolume24hUsd = toNumber(agg.volume_24h_usd)
  const creatorCoinsFees24hUsd = toNumber(agg.fees_24h_usd)

  // Read sparkline history before optional snapshot write so the dashboard can paint sooner.
  const historyResult = await db.sql`
    SELECT day::text AS day, creator_coins_market_cap_usd
    FROM creator_metrics_daily_snapshots
    WHERE day >= CURRENT_DATE - INTERVAL '29 days'
    ORDER BY day ASC;
  `
  const history30d = mapHistoryRows(
    Array.isArray((historyResult as any)?.rows) ? (historyResult as any).rows : [],
  )

  // Persist one daily canonical snapshot (non-blocking for response assembly).
  await db.sql`
    INSERT INTO creator_metrics_daily_snapshots (
      day,
      creators_total,
      creator_coins_market_cap_usd,
      creator_coins_volume_24h_usd,
      creator_coins_fees_24h_usd,
      updated_at
    )
    VALUES (
      CURRENT_DATE,
      ${creatorsTotal},
      ${creatorCoinsMarketCapUsd},
      ${creatorCoinsVolume24hUsd},
      ${creatorCoinsFees24hUsd},
      NOW()
    )
    ON CONFLICT (day) DO UPDATE SET
      creators_total = EXCLUDED.creators_total,
      creator_coins_market_cap_usd = EXCLUDED.creator_coins_market_cap_usd,
      creator_coins_volume_24h_usd = EXCLUDED.creator_coins_volume_24h_usd,
      creator_coins_fees_24h_usd = EXCLUDED.creator_coins_fees_24h_usd,
      updated_at = NOW()
    WHERE
      creator_metrics_daily_snapshots.creators_total IS DISTINCT FROM EXCLUDED.creators_total
      OR creator_metrics_daily_snapshots.creator_coins_market_cap_usd IS DISTINCT FROM EXCLUDED.creator_coins_market_cap_usd
      OR creator_metrics_daily_snapshots.creator_coins_volume_24h_usd IS DISTINCT FROM EXCLUDED.creator_coins_volume_24h_usd
      OR creator_metrics_daily_snapshots.creator_coins_fees_24h_usd IS DISTINCT FROM EXCLUDED.creator_coins_fees_24h_usd
      OR creator_metrics_daily_snapshots.updated_at < NOW() - make_interval(secs => ${SNAPSHOT_WRITE_MIN_INTERVAL_SECONDS});
  `

  const freshnessTimestamp =
    lastHotRefreshAt ??
    lastSyncFinishedAt ??
    (Number.isFinite(cachedTotalsAtMs) ? new Date(cachedTotalsAtMs).toISOString() : null) ??
    new Date().toISOString()

  return {
    scope,
    updatedAt: freshnessTimestamp,
    exact,
    syncStatus,
    sync: {
      backfillComplete,
      exploreBackfillComplete,
      sampledCreators,
      lastSyncStartedAt,
      lastSyncFinishedAt,
      lastHotRefreshAt,
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
      ethosScoredCreators: null,
      ethos1200Creators: null,
      ethos1600Creators: null,
      ethos1800Creators: null,
      partial: !exact,
      sampledCreators,
    },
    history30d,
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
        staleRefreshBlockedUntilMs = 0
        metricsCache = { payload, cachedAt: Date.now() }
        return payload
      })
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  }

  try {
    const allowRefreshAttempt = !cached || now >= staleRefreshBlockedUntilMs
    const refresh = allowRefreshAttempt ? startRefresh() : null
    if (cached) {
      if (refresh) {
        // Refresh in background while serving stale cache; explicitly catch
        // to avoid unhandled rejections on transient DB failures.
        void refresh.catch((err) => {
          noteRefreshFailure(err)
        })
      }
      // Serve stale cache while canonical refresh runs in background.
      setCache(res, 30)
      return res.status(200).json({ success: true, data: cached.payload })
    }

    const fresh = await (refresh ?? startRefresh())
    setCache(res, 60)
    return res.status(200).json({ success: true, data: fresh })
  } catch (e: any) {
    if (cached) {
      setCache(res, 15)
      return res.status(200).json({ success: true, data: cached.payload })
    }
    noteRefreshFailure(e)
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to compute canonical metrics',
    })
  }
}
