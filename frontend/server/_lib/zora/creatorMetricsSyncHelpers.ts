export type ExploreList = 'NEW_CREATORS' | 'TOP_VOLUME_CREATORS_24H' | 'MOST_VALUABLE_CREATORS'
export type FeeModel = 'legacy' | 'v4'

export type ExploreCoinFinancialSnapshot = {
  coinAddress: string
  creatorAddress: string
  createdAt: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  fees24hUsd: number | null
  feeModel: FeeModel
}

type CoinCandidate = {
  address?: unknown
  creatorAddress?: unknown
  payoutRecipientAddress?: unknown
  createdAt?: unknown
  marketCap?: unknown
  volume24h?: unknown
  market?: { protocolVersion?: unknown; feeBps?: unknown } | null
}

const LEGACY_FEE_RATE = 0.03
const V4_FEE_RATE = 0.01
const V4_CUTOFF_MS = Date.parse('2025-06-06T00:00:00Z')

export const DEFAULT_HOT_REFRESH_LISTS: readonly ExploreList[] = [
  'TOP_VOLUME_CREATORS_24H',
  'MOST_VALUABLE_CREATORS',
  'NEW_CREATORS',
]

export function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return null
  return n
}

export function normalizeAddress(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null
  return s.toLowerCase()
}

export function parseTimestamp(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const ms = Date.parse(v)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function detectFeeModel(coin: CoinCandidate): FeeModel {
  const feeBps = toFiniteNumber(coin?.market?.feeBps)
  if (feeBps === 300) return 'legacy'
  if (feeBps === 100) return 'v4'

  const protocolVersion =
    typeof coin?.market?.protocolVersion === 'string' ? coin.market.protocolVersion.toLowerCase() : ''
  if (protocolVersion.includes('legacy') || protocolVersion.includes('v3')) return 'legacy'
  if (protocolVersion.includes('v4')) return 'v4'

  const createdAtMs = typeof coin?.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
  if (!Number.isFinite(createdAtMs)) return 'v4'
  return createdAtMs >= V4_CUTOFF_MS ? 'v4' : 'legacy'
}

export function feeRateFromModel(feeModel: FeeModel): number {
  return feeModel === 'legacy' ? LEGACY_FEE_RATE : V4_FEE_RATE
}

export function computeFees24hUsd(volume24hUsd: number | null, feeModel: FeeModel): number | null {
  if (volume24hUsd == null) return null
  return volume24hUsd * feeRateFromModel(feeModel)
}

export function parseExploreCoinFinancialSnapshot(coin: unknown): ExploreCoinFinancialSnapshot | null {
  if (!coin || typeof coin !== 'object') return null
  const candidate = coin as CoinCandidate
  const coinAddress = normalizeAddress(candidate.address)
  const creatorAddress =
    normalizeAddress(candidate.creatorAddress) ?? normalizeAddress(candidate.payoutRecipientAddress)
  if (!coinAddress || !creatorAddress) return null

  const feeModel = detectFeeModel(candidate)
  const volume24hUsd = toFiniteNumber(candidate.volume24h)
  return {
    coinAddress,
    creatorAddress,
    createdAt: parseTimestamp(candidate.createdAt),
    marketCapUsd: toFiniteNumber(candidate.marketCap),
    volume24hUsd,
    fees24hUsd: computeFees24hUsd(volume24hUsd, feeModel),
    feeModel,
  }
}

export function isStaleRunningLock(
  lastSyncStartedAt: string | null | undefined,
  nowMs: number,
  thresholdMs: number,
): boolean {
  if (!lastSyncStartedAt) return true
  const startedMs = Date.parse(lastSyncStartedAt)
  if (!Number.isFinite(startedMs)) return true
  return nowMs - startedMs >= thresholdMs
}

export type ExploreListCheckpoint = {
  after: string | null
  complete: boolean
}

export type ExploreBackfillCheckpoints = Record<ExploreList, ExploreListCheckpoint>

function emptyExploreCheckpoint(): ExploreListCheckpoint {
  return { after: null, complete: false }
}

export function createDefaultExploreBackfillCheckpoints(): ExploreBackfillCheckpoints {
  return {
    NEW_CREATORS: emptyExploreCheckpoint(),
    TOP_VOLUME_CREATORS_24H: emptyExploreCheckpoint(),
    MOST_VALUABLE_CREATORS: emptyExploreCheckpoint(),
  }
}

export function parseExploreBackfillCheckpoints(raw: unknown): ExploreBackfillCheckpoints {
  const defaults = createDefaultExploreBackfillCheckpoints()
  if (typeof raw !== 'string' || raw.trim().length === 0) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ExploreList, Partial<ExploreListCheckpoint>>>
    for (const list of DEFAULT_HOT_REFRESH_LISTS) {
      const entry = parsed[list]
      if (!entry || typeof entry !== 'object') continue
      defaults[list] = {
        after: typeof entry.after === 'string' && entry.after.length > 0 ? entry.after : null,
        complete: Boolean(entry.complete),
      }
    }
  } catch {
    return createDefaultExploreBackfillCheckpoints()
  }
  return defaults
}

export function serializeExploreBackfillCheckpoints(checkpoints: ExploreBackfillCheckpoints): string {
  return JSON.stringify(checkpoints)
}

export function isExploreBackfillComplete(checkpoints: ExploreBackfillCheckpoints): boolean {
  return DEFAULT_HOT_REFRESH_LISTS.every((list) => checkpoints[list]?.complete === true)
}

export function extractExploreListEdges(response: unknown): {
  edges: Array<{ node?: unknown }>
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
} {
  const list =
    (response as any)?.data?.exploreList ??
    (response as any)?.data?.creatorCoins ??
    (response as any)?.data?.coins ??
    null
  const edges = Array.isArray(list?.edges) ? list.edges : []
  const pageInfo = list?.pageInfo ?? {}
  return {
    edges,
    pageInfo: {
      hasNextPage: Boolean(pageInfo?.hasNextPage),
      endCursor: typeof pageInfo?.endCursor === 'string' ? pageInfo.endCursor : null,
    },
  }
}
