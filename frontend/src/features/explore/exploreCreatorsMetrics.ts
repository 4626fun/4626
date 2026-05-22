import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export const EXPLORE_CREATORS_METRICS_QUERY_KEY = ['explore', 'creators', 'metrics', 'shared-dashboard'] as const
export const LIVE_HERO_METRICS_REFETCH_MS = 10_000

export type ExploreCreatorsMetrics = {
  scope: 'creators'
  updatedAt: string
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
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
    ethosScoredCreators: number | null
    ethos1200Creators: number | null
    ethos1600Creators: number | null
    ethos1800Creators: number | null
    partial: boolean
    sampledCreators: number
    usingZoraExploreFinancials?: boolean
  }
  history30d: Array<{
    date: string
    creatorCoinsMarketCapUsd: number | null
  }>
}

let cachedExploreMetrics: ExploreCreatorsMetrics | null = null

export function readCachedExploreCreatorsMetrics(): ExploreCreatorsMetrics | null {
  return cachedExploreMetrics
}

export function writeCachedExploreCreatorsMetrics(metrics: ExploreCreatorsMetrics | null): void {
  cachedExploreMetrics = metrics
}

export async function fetchExploreCreatorsMetrics(): Promise<ExploreCreatorsMetrics | null> {
  try {
    const res = await apiFetch(`${API_ENDPOINTS.zora.metrics}?scope=creators`, { method: 'GET' })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreCreatorsMetrics | null> | null
    if (res.ok && json?.success) return json.data ?? null
  } catch {
    // Non-blocking metrics card.
  }
  return null
}

export function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return null
  return n
}

export function coalesceMetricValue(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value == null) continue
    if (Number.isFinite(value)) return value
  }
  return null
}

export function preferLiveMetricValue(
  canonical: number | null | undefined,
  live: number | null | undefined,
): number | null {
  const canonicalValue = toFiniteNumber(canonical)
  const liveValue = toFiniteNumber(live)
  if (canonicalValue == null) return liveValue
  if (liveValue == null) return canonicalValue
  return Math.max(canonicalValue, liveValue)
}

export function buildExploreHeroStatusLine(input: {
  updatedAt: string | null
  exact: boolean
  syncStatus: ExploreCreatorsMetrics['syncStatus']
  creatorsTotal: number | null
  syncMeta: ExploreCreatorsMetrics['sync'] | null
  usingLiveFinancials: boolean
}): string {
  const { updatedAt, exact, syncStatus, creatorsTotal, syncMeta, usingLiveFinancials } = input

  if (!updatedAt) return 'Canonical totals unavailable'

  const time = new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const indexedLine =
    !exact && creatorsTotal != null
      ? syncMeta?.driftEstimateTotal && syncMeta.driftEstimateTotal > creatorsTotal
        ? `Indexed ${creatorsTotal.toLocaleString()} of ~${syncMeta.driftEstimateTotal.toLocaleString()} creators`
        : `Indexed ${creatorsTotal.toLocaleString()} creators`
      : null

  if (syncStatus === 'error') {
    return indexedLine ?? `Metrics refresh error — showing last known values (${time})`
  }

  if (usingLiveFinancials) {
    return indexedLine
      ? `${indexedLine} · live vol/fees from Zora`
      : `Live vol/fees from Zora · indexed totals refreshed ${time}`
  }

  if (syncStatus === 'running' || !exact) {
    return indexedLine ?? `Estimated totals refreshed ${time}`
  }

  return `Canonical totals refreshed ${time}`
}
