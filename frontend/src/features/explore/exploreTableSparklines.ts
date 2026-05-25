import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { ZoraCoin } from '@/lib/zora/types'

export type ExploreTableSparkline = {
  values: number[]
  changePercent: number | null
}

export type ExploreTableSparklinesResponse = {
  sparklines: Record<string, ExploreTableSparkline>
}

const STORAGE_KEY = '4626:explore:table-sparklines:v1'
const STORAGE_MAX_AGE_MS = 6 * 60 * 60_000

type PersistedSparklineEntry = ExploreTableSparkline & { savedAt: number }

function isValidSparkline(entry: ExploreTableSparkline | null | undefined): entry is ExploreTableSparkline {
  return Boolean(entry && Array.isArray(entry.values) && entry.values.length >= 2)
}

export function seedSparklinesFromCoins(
  coins: ReadonlyArray<Pick<ZoraCoin, 'address' | 'trend30d'>>,
): Map<string, ExploreTableSparkline> {
  const map = new Map<string, ExploreTableSparkline>()
  for (const coin of coins) {
    const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
    if (!address || !isValidSparkline(coin.trend30d)) continue
    map.set(address, {
      values: [...coin.trend30d.values],
      changePercent: coin.trend30d.changePercent ?? null,
    })
  }
  return map
}

export function readPersistedExploreTableSparklines(): Map<string, ExploreTableSparkline> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, PersistedSparklineEntry> | null
    if (!parsed || typeof parsed !== 'object') return new Map()

    const now = Date.now()
    const map = new Map<string, ExploreTableSparkline>()
    for (const [address, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.savedAt !== 'number') continue
      if (now - entry.savedAt > STORAGE_MAX_AGE_MS) continue
      if (!isValidSparkline(entry)) continue
      map.set(address.toLowerCase(), {
        values: [...entry.values],
        changePercent: entry.changePercent ?? null,
      })
    }
    return map
  } catch {
    return new Map()
  }
}

export function writePersistedExploreTableSparklines(
  entries: ReadonlyMap<string, ExploreTableSparkline>,
): void {
  if (typeof window === 'undefined' || entries.size === 0) return
  try {
    const existing = readPersistedExploreTableSparklines()
    const savedAt = Date.now()
    for (const [address, sparkline] of entries) {
      if (!isValidSparkline(sparkline)) continue
      existing.set(address.toLowerCase(), {
        values: [...sparkline.values],
        changePercent: sparkline.changePercent ?? null,
      })
    }

    const payload: Record<string, PersistedSparklineEntry> = {}
    for (const [address, sparkline] of existing) {
      payload[address] = {
        values: [...sparkline.values],
        changePercent: sparkline.changePercent ?? null,
        savedAt,
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota/private mode — skip persistence.
  }
}

export function mergeExploreTableSparklineMaps(
  ...sources: ReadonlyArray<ReadonlyMap<string, ExploreTableSparkline> | undefined>
): Map<string, ExploreTableSparkline> {
  const merged = new Map<string, ExploreTableSparkline>()
  for (const source of sources) {
    if (!source) continue
    for (const [address, sparkline] of source) {
      if (!isValidSparkline(sparkline)) continue
      merged.set(address.toLowerCase(), sparkline)
    }
  }
  return merged
}

export async function fetchExploreTableSparklines(
  coinAddresses: string[],
): Promise<Map<string, ExploreTableSparkline>> {
  const normalized = [...new Set(coinAddresses.map((address) => address.toLowerCase()).filter(Boolean))]
  if (normalized.length === 0) return new Map()

  const query = new URLSearchParams({ coins: normalized.join(',') })
  const res = await apiFetch(`/api/zora/exploreSparklines?${query.toString()}`, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreTableSparklinesResponse> | null
  if (!res.ok || !json?.success || !json.data?.sparklines) return new Map()

  return new Map(Object.entries(json.data.sparklines))
}
