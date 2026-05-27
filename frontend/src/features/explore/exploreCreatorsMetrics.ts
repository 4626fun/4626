import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export const EXPLORE_CREATORS_METRICS_QUERY_KEY = ['explore', 'creators', 'metrics', 'shared-dashboard'] as const
/** Align with server metrics cache (~5 min) to avoid redundant polls. */
export const LIVE_HERO_METRICS_REFETCH_MS = 120_000

const METRICS_STORAGE_KEY = '4626:explore:creators:metrics:v1'
/** Keep persisted hero metrics for instant paint across reloads; server remains source of truth. */
const METRICS_STORAGE_MAX_AGE_MS = 10 * 60_000

export type ExploreCreatorsMetrics = {
  scope: 'creators'
  updatedAt: string
  exact: boolean
  syncStatus: 'idle' | 'running' | 'error'
  sync: {
    backfillComplete: boolean
    exploreBackfillComplete: boolean
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

let cachedExploreMetrics: ExploreCreatorsMetrics | null = null

function readPersistedExploreCreatorsMetrics(): ExploreCreatorsMetrics | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(METRICS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: ExploreCreatorsMetrics } | null
    if (!parsed?.data || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > METRICS_STORAGE_MAX_AGE_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export function readCachedExploreCreatorsMetrics(): ExploreCreatorsMetrics | null {
  return cachedExploreMetrics ?? readPersistedExploreCreatorsMetrics()
}

export function writeCachedExploreCreatorsMetrics(metrics: ExploreCreatorsMetrics | null): void {
  cachedExploreMetrics = metrics
  if (typeof window === 'undefined' || !metrics) return
  try {
    window.localStorage.setItem(
      METRICS_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), data: metrics }),
    )
  } catch {
    // Quota/private mode — in-memory cache still applies for this session.
  }
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

export function buildExploreHeroStatusLine(input: {
  updatedAt: string | null
  exact: boolean
  syncStatus: ExploreCreatorsMetrics['syncStatus']
  creatorsTotal: number | null
  syncMeta: ExploreCreatorsMetrics['sync'] | null
}): string {
  const { updatedAt, exact, syncStatus, creatorsTotal, syncMeta } = input

  if (!updatedAt) return 'Indexed totals unavailable'

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

  if (!exact) {
    const partialNote = 'Financial totals sum indexed coins only'
    return indexedLine ? `${indexedLine} · ${partialNote}` : `${partialNote} · refreshed ${time}`
  }

  return indexedLine ?? `Indexed totals refreshed ${time}`
}
