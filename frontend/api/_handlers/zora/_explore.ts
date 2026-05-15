import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '../../../packages/server-core/src/index.js'

type ExploreList =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'
  // Trend-specific
  | 'MOST_VALUABLE_TRENDS'
  | 'NEW_TRENDS'
  | 'TOP_VOLUME_TRENDS_24H'
  | 'TRENDING_TRENDS'
  // Creator-specific
  | 'NEW_CREATORS'
  | 'MOST_VALUABLE_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'
  | 'FEATURED_CREATORS'
  | 'TRENDING_CREATORS'
  // Content-specific
  | 'FEATURED_VIDEOS'
  | 'TRENDING_POSTS'
  // Combined
  | 'TRENDING_ALL'
  | 'TOP_VOLUME_ALL_24H'
  | 'NEW_ALL'
  | 'MOST_VALUABLE_ALL'

type ExploreSort = 'DEFAULT' | 'ETHOS_SCORE'

function parseList(value: string | null): ExploreList {
  switch (value) {
    case 'TOP_VOLUME_24H':
    case 'MOST_VALUABLE':
    case 'NEW':
    case 'LAST_TRADED':
    case 'LAST_TRADED_UNIQUE':
    case 'MOST_VALUABLE_TRENDS':
    case 'NEW_TRENDS':
    case 'TOP_VOLUME_TRENDS_24H':
    case 'TRENDING_TRENDS':
    case 'NEW_CREATORS':
    case 'MOST_VALUABLE_CREATORS':
    case 'TOP_VOLUME_CREATORS_24H':
    case 'FEATURED_CREATORS':
    case 'TRENDING_CREATORS':
    case 'FEATURED_VIDEOS':
    case 'TRENDING_POSTS':
    case 'TRENDING_ALL':
    case 'TOP_VOLUME_ALL_24H':
    case 'NEW_ALL':
    case 'MOST_VALUABLE_ALL':
      return value
    default:
      return 'TOP_GAINERS'
  }
}

function parseSort(value: string | null): ExploreSort {
  return value === 'ETHOS_SCORE' ? 'ETHOS_SCORE' : 'DEFAULT'
}

function normalizeExploreResponse(response: any) {
  if (response?.data?.edges || response?.data?.pageInfo) return response.data
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
}

function shortSymbol(address: string): string {
  return `${address.slice(2, 6).toUpperCase()}`
}

function toNumericString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? String(n) : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

async function buildEthosSortedCreatorList(params: {
  count: number
  after: string | null
  ethosMin: number | null
  key: string | null
}) {
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const offset = Math.max(0, Number.parseInt(params.after ?? '0', 10) || 0)
  const limitPlusOne = params.count + 1

  const rows = await db.sql`
    WITH ranked_creator_coins AS (
      SELECT
        cc.coin_address,
        lower(cc.creator_address) AS creator_address,
        cc.created_at,
        cc.market_cap_usd,
        cc.volume_24h_usd,
        ROW_NUMBER() OVER (
          PARTITION BY lower(cc.creator_address)
          ORDER BY
            cc.volume_24h_usd DESC NULLS LAST,
            cc.market_cap_usd DESC NULLS LAST,
            cc.created_at DESC NULLS LAST,
            cc.coin_address ASC
        ) AS creator_coin_rank
      FROM creator_coins cc
      WHERE cc.chain_id = 8453
    )
    SELECT
      rcc.coin_address,
      rcc.creator_address,
      rcc.created_at,
      rcc.market_cap_usd,
      rcc.volume_24h_usd,
      es.score AS ethos_score,
      es.level AS ethos_level
    FROM ranked_creator_coins rcc
    LEFT JOIN ethos_userkey_scores es
      ON es.ethos_userkey = ('address:' || rcc.creator_address)
      AND es.status = 'matched'
    WHERE rcc.creator_coin_rank = 1
      AND (${params.ethosMin}::numeric IS NULL OR es.score >= ${params.ethosMin})
    ORDER BY
      CASE WHEN es.score IS NULL THEN 1 ELSE 0 END ASC,
      es.score DESC NULLS LAST,
      rcc.volume_24h_usd DESC NULLS LAST,
      rcc.market_cap_usd DESC NULLS LAST,
      rcc.creator_address ASC
    OFFSET ${offset}
    LIMIT ${limitPlusOne};
  `

  const selected = (rows.rows ?? []) as Array<{
    coin_address: string
    creator_address: string
    created_at: string | null
    market_cap_usd: string | number | null
    volume_24h_usd: string | number | null
    ethos_score: number | null
    ethos_level: string | null
  }>
  const hasNextPage = selected.length > params.count
  const pageRows = hasNextPage ? selected.slice(0, params.count) : selected

  let coinDetails = new Map<string, any>()
  if (params.key) {
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(params.key)
      const responses = await Promise.allSettled(
        pageRows.map((row) => sdk.getCoin({ address: row.coin_address, chain: 8453 })),
      )
      responses.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const row = pageRows[index]
        if (!row) return
        const token = result.value?.data?.zora20Token
        if (token) coinDetails.set(row.coin_address.toLowerCase(), token)
      })
    } catch {
      coinDetails = new Map()
    }
  }

  const edges = pageRows.map((row, idx) => {
    const detail = coinDetails.get(String(row.coin_address).toLowerCase()) ?? null
    const address = String(row.coin_address).toLowerCase()
    const creatorAddress = String(row.creator_address).toLowerCase()
    const displayName = typeof detail?.name === 'string' && detail.name.trim() ? detail.name.trim() : shortSymbol(address)
    const displaySymbol = typeof detail?.symbol === 'string' && detail.symbol.trim() ? detail.symbol.trim() : shortSymbol(address)
    const marketCap = toNumericString(detail?.marketCap) ?? toNumericString(row.market_cap_usd)
    const volume24h = toNumericString(detail?.volume24h) ?? toNumericString(row.volume_24h_usd)
    const creatorProfile = detail?.creatorProfile
    return {
      cursor: String(offset + idx + 1),
      node: {
        id: typeof detail?.id === 'string' ? detail.id : undefined,
        address,
        creatorAddress,
        payoutRecipientAddress: creatorAddress,
        name: displayName,
        symbol: displaySymbol,
        coinType: 'CREATOR',
        chainId: 8453,
        createdAt: (typeof detail?.createdAt === 'string' && detail.createdAt) || row.created_at || undefined,
        marketCap,
        volume24h,
        totalVolume: typeof detail?.totalVolume === 'string' ? detail.totalVolume : undefined,
        uniqueHolders: typeof detail?.uniqueHolders === 'number' ? detail.uniqueHolders : undefined,
        mediaContent: detail?.mediaContent,
        creatorProfile,
        ethosScore: typeof row.ethos_score === 'number' ? row.ethos_score : null,
        ethosLevel: row.ethos_level ?? null,
      },
    }
  })

  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(offset + params.count) : null,
    },
    count: edges.length,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const key = requireServerKey()
  if (!key) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const list = parseList(getStringQuery(req, 'list'))
  const sort = parseSort(getStringQuery(req, 'sort'))
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined
  const ethosMin = (() => {
    const raw = getNumberQuery(req, 'ethosMin')
    return Number.isFinite(raw ?? NaN) ? Number(raw) : null
  })()

  if (
    sort === 'ETHOS_SCORE' &&
    (list === 'NEW_CREATORS' || list === 'MOST_VALUABLE_CREATORS' || list === 'TOP_VOLUME_CREATORS_24H')
  ) {
    try {
      const data = await buildEthosSortedCreatorList({
        count,
        after: after ?? null,
        ethosMin,
        key,
      })
      setCache(res, 120)
      return res.status(200).json({
        success: true,
        data,
      })
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 500
      return res.status(status).json({
        success: false,
        error: e?.message || 'Failed to fetch Ethos-sorted creators',
      })
    }
  }

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const options = { count, after }
    
    // Map list type to SDK function
    const sdkFunctions: Record<ExploreList, () => Promise<any>> = {
      'TOP_GAINERS': () => sdk.getCoinsTopGainers(options),
      'TOP_VOLUME_24H': () => sdk.getCoinsTopVolume24h(options),
      'MOST_VALUABLE': () => sdk.getCoinsMostValuable(options),
      'NEW': () => sdk.getCoinsNew(options),
      'LAST_TRADED': () => sdk.getCoinsLastTraded(options),
      'LAST_TRADED_UNIQUE': () => sdk.getCoinsLastTradedUnique(options),
      // Trend-specific
      'MOST_VALUABLE_TRENDS': () => sdk.getMostValuableTrends(options),
      'NEW_TRENDS': () => sdk.getNewTrends(options),
      'TOP_VOLUME_TRENDS_24H': () => sdk.getTopVolumeTrends24h(options),
      'TRENDING_TRENDS': () => sdk.getTrendingTrends(options),
      // Creator-specific
      'NEW_CREATORS': () => sdk.getCreatorCoins(options),
      'MOST_VALUABLE_CREATORS': () => sdk.getMostValuableCreatorCoins(options),
      'TOP_VOLUME_CREATORS_24H': () => sdk.getExploreTopVolumeCreators24h(options),
      'FEATURED_CREATORS': () => sdk.getExploreFeaturedCreators(options),
      'TRENDING_CREATORS': () => sdk.getTrendingCreators(options),
      // Content-specific
      'FEATURED_VIDEOS': () => sdk.getExploreFeaturedVideos(options),
      'TRENDING_POSTS': () => sdk.getTrendingPosts(options),
      // Combined
      'TRENDING_ALL': () => sdk.getTrendingAll(options),
      'TOP_VOLUME_ALL_24H': () => sdk.getExploreTopVolumeAll24h(options),
      'NEW_ALL': () => sdk.getExploreNewAll(options),
      'MOST_VALUABLE_ALL': () => sdk.getMostValuableAll(options),
    }
    
    const fn = sdkFunctions[list] || (() => sdk.getCoinsTopGainers(options))
    const response = await fn()

    // Handle different response structures from both coin and creator list endpoints.
    const data = normalizeExploreResponse(response)

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch explore list',
    })
  }
}


