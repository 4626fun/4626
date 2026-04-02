import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DEFAULT_LIST_LIMIT = 20
const MAX_LIST_LIMIT = 50
const TREND_LOOKUP_LIMIT = 50
const PRICE_HISTORY_LIMIT = 200

type Sdk = typeof import('@zoralabs/coins-sdk')

type ExploreListType =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'
  | 'MOST_VALUABLE_TRENDS'
  | 'NEW_TRENDS'
  | 'TOP_VOLUME_TRENDS_24H'
  | 'TRENDING_TRENDS'
  | 'NEW_CREATORS'
  | 'MOST_VALUABLE_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'
  | 'FEATURED_CREATORS'
  | 'TRENDING_CREATORS'
  | 'FEATURED_VIDEOS'
  | 'TRENDING_POSTS'
  | 'TRENDING_ALL'
  | 'TOP_VOLUME_ALL_24H'
  | 'NEW_ALL'
  | 'MOST_VALUABLE_ALL'

export type ZoraCliSort = 'mcap' | 'volume' | 'new' | 'trending' | 'featured'
export type ZoraCliType = 'all' | 'creator-coin' | 'post' | 'trend'
export type ZoraCliInterval = '1h' | '24h' | '1w' | '1m' | 'ALL'

export type ZoraCliCoin = {
  name: string
  address: string
  coinType: ZoraCliType
  symbol: string | null
  marketCap: string | null
  volume24h: string | null
  uniqueHolders: number | null
  createdAt: string | null
  creatorHandle: string | null
}

export type ZoraCliExploreResult = {
  coins: ZoraCliCoin[]
  nextCursor: string | null
}

export type ZoraCliGetResult = ZoraCliCoin

export type ZoraCliProfilePost = {
  name: string
  address: string
  marketCap: string | null
  volume24h: string | null
}

export type ZoraCliProfileResult = {
  profile: {
    id: string | null
    handle: string | null
    creatorCoinAddress: string | null
  } | null
  posts: ZoraCliProfilePost[]
  nextCursor: string | null
}

export type ZoraCliPricePoint = {
  timestamp: string
  price: number
}

export type ZoraCliPriceHistoryResult = {
  coin: {
    name: string
    address: string
    coinType: ZoraCliType
  }
  interval: ZoraCliInterval
  high: number | null
  low: number | null
  change: number | null
  prices: ZoraCliPricePoint[]
}

export type ZoraCliAuthStatusResult = {
  authenticated: boolean
}

export type ZoraCliErrorPayload = {
  error: string
  suggestion?: string
}

export class ZoraCliCompatError extends Error {
  status: number
  suggestion?: string

  constructor(message: string, options?: { status?: number; suggestion?: string }) {
    super(message)
    this.name = 'ZoraCliCompatError'
    this.status = options?.status ?? 500
    this.suggestion = options?.suggestion
  }
}

function isAddressLike(value: string): value is `0x${string}` {
  return EVM_ADDRESS_RE.test(value)
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeCoinType(value: unknown): ZoraCliType {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'CREATOR') return 'creator-coin'
  if (raw === 'TREND') return 'trend'
  if (raw === 'CONTENT' || raw === 'POST') return 'post'
  return 'post'
}

function normalizeSort(value: string | null | undefined): ZoraCliSort {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'mcap' || raw === 'volume' || raw === 'new' || raw === 'featured') return raw
  return 'trending'
}

function normalizeExploreType(value: string | null | undefined): ZoraCliType {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'creator-coin' || raw === 'post' || raw === 'trend') return raw
  return 'all'
}

function normalizeInterval(value: string | null | undefined): ZoraCliInterval {
  const raw = String(value ?? '').trim()
  if (raw === '1h' || raw === '24h' || raw === '1w' || raw === '1m' || raw === 'ALL') return raw
  return '24h'
}

function clampLimit(value: number | null | undefined, fallback = DEFAULT_LIST_LIMIT): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.min(Math.max(parsed, 1), MAX_LIST_LIMIT)
}

function normalizeExploreResponse(response: any): { edges?: any[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string } } | null {
  if (response?.data?.edges || response?.data?.pageInfo) return response.data
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
}

function readCoinFromResponse(response: any): any | null {
  return response?.data?.zora20Token ?? response?.data?.zora?.coin ?? null
}

function mapCoin(node: any): ZoraCliCoin | null {
  const address = toNullableString(node?.address)
  if (!address || !isAddressLike(address)) return null

  return {
    name:
      toNullableString(node?.name) ??
      toNullableString(node?.title) ??
      toNullableString(node?.symbol) ??
      address,
    address: address.toLowerCase(),
    coinType: normalizeCoinType(node?.coinType),
    symbol: toNullableString(node?.symbol),
    marketCap: toNullableString(node?.marketCap),
    volume24h: toNullableString(node?.volume24h),
    uniqueHolders: toNullableNumber(node?.uniqueHolders),
    createdAt: toNullableString(node?.createdAt),
    creatorHandle: toNullableString(node?.creatorProfile?.handle),
  }
}

function resolveExploreList(sort: ZoraCliSort, type: ZoraCliType): ExploreListType {
  if (type === 'creator-coin') {
    if (sort === 'mcap') return 'MOST_VALUABLE_CREATORS'
    if (sort === 'volume') return 'TOP_VOLUME_CREATORS_24H'
    if (sort === 'new') return 'NEW_CREATORS'
    if (sort === 'featured') return 'FEATURED_CREATORS'
    return 'TRENDING_CREATORS'
  }
  if (type === 'trend') {
    if (sort === 'mcap') return 'MOST_VALUABLE_TRENDS'
    if (sort === 'volume') return 'TOP_VOLUME_TRENDS_24H'
    if (sort === 'new') return 'NEW_TRENDS'
    return 'TRENDING_TRENDS'
  }
  if (type === 'post') {
    if (sort === 'new') return 'NEW'
    if (sort === 'featured') return 'FEATURED_VIDEOS'
    if (sort === 'trending') return 'TRENDING_POSTS'
    if (sort === 'volume') return 'TOP_VOLUME_24H'
    return 'MOST_VALUABLE'
  }
  if (sort === 'mcap') return 'MOST_VALUABLE_ALL'
  if (sort === 'volume') return 'TOP_VOLUME_ALL_24H'
  if (sort === 'new') return 'NEW_ALL'
  if (sort === 'featured') return 'FEATURED_CREATORS'
  return 'TRENDING_ALL'
}

function normalizeCompareKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function loadSdk(serverKey: string): Promise<Sdk> {
  const sdk: Sdk = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(serverKey)
  return sdk
}

async function resolveCoinAddress(params: {
  sdk: Sdk
  reference: string
  coinType?: string | null
}): Promise<`0x${string}`> {
  const reference = params.reference.trim()
  if (!reference) {
    throw new ZoraCliCompatError('Missing coin identifier.', {
      status: 400,
      suggestion: 'Provide a coin address or lookup key (for example: creator handle).',
    })
  }
  if (isAddressLike(reference)) {
    return reference.toLowerCase() as `0x${string}`
  }

  const normalizedType = normalizeExploreType(params.coinType)

  if (normalizedType === 'creator-coin' || normalizedType === 'all' || !params.coinType) {
    const profileResponse = await params.sdk.getProfile({ identifier: reference })
    const creatorAddress = toNullableString(profileResponse?.data?.profile?.creatorCoin?.address)
    if (creatorAddress && isAddressLike(creatorAddress)) {
      return creatorAddress.toLowerCase() as `0x${string}`
    }
  }

  if (normalizedType === 'trend' || normalizedType === 'all' || !params.coinType) {
    const lookups: ExploreListType[] = ['TRENDING_TRENDS', 'MOST_VALUABLE_TRENDS', 'NEW_TRENDS']
    const targetKey = normalizeCompareKey(reference)
    for (const listType of lookups) {
      const response = await params.sdk.getExploreList(listType, { count: TREND_LOOKUP_LIMIT })
      const list = normalizeExploreResponse(response)
      const edges = Array.isArray(list?.edges) ? list.edges : []
      for (const edge of edges) {
        const node = edge?.node
        const address = toNullableString(node?.address)
        if (!address || !isAddressLike(address)) continue
        const keys = [toNullableString(node?.symbol), toNullableString(node?.name), toNullableString(node?.title)]
          .filter((value): value is string => Boolean(value))
          .map((value) => normalizeCompareKey(value))
        if (keys.includes(targetKey)) {
          return address.toLowerCase() as `0x${string}`
        }
      }
    }
  }

  throw new ZoraCliCompatError('Unable to resolve coin identifier.', {
    status: 404,
    suggestion: 'Use a 0x coin address, or pass type=creator-coin with a valid creator handle.',
  })
}

function intervalWindowMs(interval: ZoraCliInterval): number | null {
  if (interval === '1h') return 60 * 60 * 1000
  if (interval === '24h') return 24 * 60 * 60 * 1000
  if (interval === '1w') return 7 * 24 * 60 * 60 * 1000
  if (interval === '1m') return 30 * 24 * 60 * 60 * 1000
  return null
}

export function toCliErrorPayload(error: unknown, fallbackSuggestion?: string): { status: number; body: ZoraCliErrorPayload } {
  if (error instanceof ZoraCliCompatError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        ...(error.suggestion ? { suggestion: error.suggestion } : {}),
      },
    }
  }
  const message = error instanceof Error ? error.message : 'Unexpected Zora compatibility error.'
  return {
    status: 500,
    body: {
      error: message,
      ...(fallbackSuggestion ? { suggestion: fallbackSuggestion } : {}),
    },
  }
}

export async function exploreCli(params: {
  serverKey: string
  sort?: string | null
  type?: string | null
  limit?: number | null
  cursor?: string | null
}): Promise<ZoraCliExploreResult> {
  const sdk = await loadSdk(params.serverKey)
  const sort = normalizeSort(params.sort)
  const type = normalizeExploreType(params.type)
  const limit = clampLimit(params.limit)
  const listType = resolveExploreList(sort, type)
  const response = await sdk.getExploreList(listType, {
    count: limit,
    after: toNullableString(params.cursor) ?? undefined,
  })
  const list = normalizeExploreResponse(response)
  const edges = Array.isArray(list?.edges) ? list.edges : []
  const coins = edges.map((edge) => mapCoin(edge?.node)).filter((coin): coin is ZoraCliCoin => Boolean(coin))
  const hasNext = list?.pageInfo?.hasNextPage === true
  const nextCursor = hasNext ? toNullableString(list?.pageInfo?.endCursor) : null
  return {
    coins: coins.slice(0, limit),
    nextCursor,
  }
}

export async function getCliCoin(params: {
  serverKey: string
  reference: string
  coinType?: string | null
}): Promise<ZoraCliGetResult> {
  const sdk = await loadSdk(params.serverKey)
  const address = await resolveCoinAddress({
    sdk,
    reference: params.reference,
    coinType: params.coinType,
  })
  const response = await sdk.getCoin({
    address,
    chain: base.id,
  })
  const coin = mapCoin(readCoinFromResponse(response))
  if (!coin) {
    throw new ZoraCliCompatError('Coin not found.', {
      status: 404,
      suggestion: 'Verify the coin address or lookup reference and try again.',
    })
  }
  return coin
}

export async function profileCli(params: {
  serverKey: string
  identifier: string
  limit?: number | null
  cursor?: string | null
}): Promise<ZoraCliProfileResult> {
  const identifier = params.identifier.trim()
  if (!identifier) {
    throw new ZoraCliCompatError('Missing identifier.', {
      status: 400,
      suggestion: 'Provide a profile handle or address.',
    })
  }
  const sdk = await loadSdk(params.serverKey)
  const limit = clampLimit(params.limit)

  const [profileResponse, profileCoinsResponse] = await Promise.all([
    sdk.getProfile({ identifier }),
    sdk.getProfileCoins({
      identifier,
      count: limit,
      after: toNullableString(params.cursor) ?? undefined,
      chainIds: [base.id],
    }),
  ])

  const profile = profileResponse?.data?.profile ?? profileCoinsResponse?.data?.profile ?? null
  const createdCoins = profileCoinsResponse?.data?.profile?.createdCoins ?? null
  const edges = Array.isArray(createdCoins?.edges) ? createdCoins.edges : []
  const posts: ZoraCliProfilePost[] = edges
    .map((edge: any) => mapCoin(edge?.node))
    .filter((coin: ZoraCliCoin | null): coin is ZoraCliCoin => Boolean(coin))
    .map((coin) => ({
      name: coin.name,
      address: coin.address,
      marketCap: coin.marketCap,
      volume24h: coin.volume24h,
    }))

  const hasNext = createdCoins?.pageInfo?.hasNextPage === true
  const nextCursor = hasNext ? toNullableString(createdCoins?.pageInfo?.endCursor) : null

  return {
    profile: profile
      ? {
          id: toNullableString(profile?.id),
          handle: toNullableString(profile?.handle),
          creatorCoinAddress: toNullableString(profile?.creatorCoin?.address),
        }
      : null,
    posts,
    nextCursor,
  }
}

export async function priceHistoryCli(params: {
  serverKey: string
  reference: string
  coinType?: string | null
  interval?: string | null
}): Promise<ZoraCliPriceHistoryResult> {
  const sdk = await loadSdk(params.serverKey)
  const interval = normalizeInterval(params.interval)
  const address = await resolveCoinAddress({
    sdk,
    reference: params.reference,
    coinType: params.coinType,
  })

  const [coinResponse, swapsResponse] = await Promise.all([
    sdk.getCoin({ address, chain: base.id }),
    sdk.getCoinSwaps({
      address,
      chain: base.id,
      first: PRICE_HISTORY_LIMIT,
    }),
  ])

  const coinNode = readCoinFromResponse(coinResponse)
  const coin = mapCoin(coinNode)
  if (!coin) {
    throw new ZoraCliCompatError('Coin not found for price history.', {
      status: 404,
      suggestion: 'Verify the coin address or lookup reference and try again.',
    })
  }

  const edges = swapsResponse?.data?.zora20Token?.swapActivities?.edges
  const allPoints: ZoraCliPricePoint[] = (Array.isArray(edges) ? edges : [])
    .map((edge: any) => {
      const node = edge?.node
      const timestamp = toNullableString(node?.blockTimestamp)
      const price = toNullableNumber(node?.currencyAmountWithPrice?.priceUsdc)
      if (!timestamp || price == null || price <= 0) return null
      return { timestamp, price }
    })
    .filter((point: ZoraCliPricePoint | null): point is ZoraCliPricePoint => Boolean(point))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))

  const windowMs = intervalWindowMs(interval)
  const points =
    windowMs == null
      ? allPoints
      : allPoints.filter((point) => {
          const ts = Date.parse(point.timestamp)
          return Number.isFinite(ts) && Date.now() - ts <= windowMs
        })

  const prices = points.map((point) => point.price)
  const high = prices.length > 0 ? Math.max(...prices) : null
  const low = prices.length > 0 ? Math.min(...prices) : null
  const first = points[0]?.price ?? null
  const last = points[points.length - 1]?.price ?? null
  const change =
    first && first > 0 && last != null ? Number((((last - first) / first) * 100).toFixed(6)) : null

  return {
    coin: {
      name: coin.name,
      address: coin.address,
      coinType: coin.coinType,
    },
    interval,
    high,
    low,
    change,
    prices: points,
  }
}

export function authStatusCli(): ZoraCliAuthStatusResult {
  const key = String(process.env.ZORA_SERVER_API_KEY ?? '').trim()
  return {
    authenticated: key.length > 0,
  }
}
