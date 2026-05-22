import { requireServerKey } from '../../zora/_shared.js'
import {
  extractExploreListEdges,
  parseExploreCoinFinancialSnapshot,
  toFiniteNumber,
  type ExploreList,
} from './creatorMetricsSyncHelpers.js'

export type ZoraExploreFinancialEstimate = {
  volume24hUsd: number
  fees24hUsd: number
  marketCapUsd: number
  coinCount: number
}

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_VOLUME_PAGES = 5
const DEFAULT_MCAP_PAGES = 5

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export function preferHigherMetric(
  canonical: number | null | undefined,
  live: number | null | undefined,
): number | null {
  const canonicalValue = toFiniteNumber(canonical)
  const liveValue = toFiniteNumber(live)
  if (canonicalValue == null) return liveValue
  if (liveValue == null) return canonicalValue
  return Math.max(canonicalValue, liveValue)
}

async function getSdk(apiKey: string): Promise<any> {
  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(apiKey)
  return sdk
}

async function fetchExplorePage(
  sdk: any,
  list: ExploreList,
  count: number,
  after?: string | null,
): Promise<any> {
  const options = after ? { count, after } : { count }
  if (list === 'TOP_VOLUME_CREATORS_24H') return sdk.getExploreTopVolumeCreators24h(options)
  if (list === 'MOST_VALUABLE_CREATORS') return sdk.getMostValuableCreatorCoins(options)
  return sdk.getCreatorCoins(options)
}

async function paginateExploreList(
  sdk: any,
  list: ExploreList,
  pageSize: number,
  maxPages: number,
  onSnapshot: (snapshot: NonNullable<ReturnType<typeof parseExploreCoinFinancialSnapshot>>) => void,
): Promise<number> {
  let pagesFetched = 0
  let after: string | null = null

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchExplorePage(sdk, list, pageSize, after)
    const { edges, pageInfo } = extractExploreListEdges(response)
    pagesFetched += 1
    if (edges.length === 0) break

    for (const edge of edges) {
      const snapshot = parseExploreCoinFinancialSnapshot(edge?.node)
      if (!snapshot) continue
      onSnapshot(snapshot)
    }

    if (!pageInfo.hasNextPage) break
    after = pageInfo.endCursor
    if (!after) break
  }

  return pagesFetched
}

export async function fetchZoraExploreFinancialEstimate(options?: {
  apiKey?: string | null
}): Promise<ZoraExploreFinancialEstimate | null> {
  const apiKey =
    options?.apiKey ??
    requireServerKey() ??
    (typeof process.env.VITE_ZORA_PUBLIC_API_KEY === 'string' ? process.env.VITE_ZORA_PUBLIC_API_KEY : null)
  if (!apiKey) return null

  const pageSize = Math.min(
    parsePositiveInt(process.env.ZORA_METRICS_EXPLORE_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    50,
  )
  const volumePages = parsePositiveInt(process.env.ZORA_METRICS_EXPLORE_VOLUME_PAGES, DEFAULT_VOLUME_PAGES)
  const mcapPages = parsePositiveInt(process.env.ZORA_METRICS_EXPLORE_MCAP_PAGES, DEFAULT_MCAP_PAGES)

  const sdk = await getSdk(apiKey)
  const seenCoins = new Set<string>()
  const marketCapByCoin = new Map<string, number>()
  let volume24hUsd = 0
  let fees24hUsd = 0

  await paginateExploreList(sdk, 'TOP_VOLUME_CREATORS_24H', pageSize, volumePages, (snapshot) => {
    seenCoins.add(snapshot.coinAddress)
    volume24hUsd += snapshot.volume24hUsd ?? 0
    fees24hUsd += snapshot.fees24hUsd ?? 0
    if (snapshot.marketCapUsd != null) {
      marketCapByCoin.set(snapshot.coinAddress, snapshot.marketCapUsd)
    }
  })

  await paginateExploreList(sdk, 'MOST_VALUABLE_CREATORS', pageSize, mcapPages, (snapshot) => {
    seenCoins.add(snapshot.coinAddress)
    if (snapshot.marketCapUsd != null) {
      marketCapByCoin.set(snapshot.coinAddress, snapshot.marketCapUsd)
    }
  })

  const marketCapUsd = [...marketCapByCoin.values()].reduce((sum, value) => sum + value, 0)
  if (volume24hUsd <= 0 && fees24hUsd <= 0 && marketCapUsd <= 0) return null

  return {
    volume24hUsd,
    fees24hUsd,
    marketCapUsd,
    coinCount: seenCoins.size,
  }
}
