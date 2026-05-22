import type { ZoraCoin } from '@/lib/zora/types'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { fetchZoraExplore } from '@/lib/zora/client'

export const EXPLORE_CREATORS_METRICS_QUERY_KEY = ['explore', 'creators', 'metrics', 'shared-dashboard'] as const
export const LIVE_HERO_METRICS_REFETCH_MS = 10_000
const LIVE_ESTIMATE_COUNT = 50
const V4_CUTOFF_DATE_MS = Date.parse('2025-06-06T00:00:00Z')

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
  }
  history30d: Array<{
    date: string
    creatorCoinsMarketCapUsd: number | null
  }>
}

export type ExploreHeroLiveFinancials = {
  volume24hUsd: number
  fees24hUsd: number
  coinCount: number
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

export async function fetchLiveHeroFinancialEstimate(
  migratedCoins: Set<string> | null = null,
): Promise<ExploreHeroLiveFinancials> {
  const volumeList = await fetchZoraExplore({
    list: 'TOP_VOLUME_CREATORS_24H',
    count: LIVE_ESTIMATE_COUNT,
  })
  const edges = Array.isArray(volumeList?.edges) ? volumeList.edges : []
  let volume24hUsd = 0
  let fees24hUsd = 0
  let coinCount = 0

  for (const edge of edges) {
    const coin = edge?.node as ZoraCoin | undefined
    if (!coin) continue
    coinCount += 1
    const volumeValue = toFiniteNumber(coin.volume24h)
    if (volumeValue == null) continue
    volume24hUsd += volumeValue
    fees24hUsd += volumeValue * inferCreatorCoinFeeRate(coin, migratedCoins)
  }

  return { volume24hUsd, fees24hUsd, coinCount }
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

export function inferCreatorCoinFeeRate(coin: ZoraCoin, migratedCoins: Set<string> | null): number {
  const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
  if (address && migratedCoins?.has(address)) return 0.01
  const createdAtMs = typeof coin.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
  if (!Number.isFinite(createdAtMs)) return 0.01
  return createdAtMs >= V4_CUTOFF_DATE_MS ? 0.01 : 0.03
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
