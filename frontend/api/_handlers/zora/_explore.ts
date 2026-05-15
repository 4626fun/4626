import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '../../../packages/server-core/src/index.js'
import { fetchFreshEthosScoresByUserkeys } from '../../../server/_lib/chat/ethosClient.js'

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

function isCreatorList(list: ExploreList): boolean {
  return (
    list === 'NEW_CREATORS' ||
    list === 'MOST_VALUABLE_CREATORS' ||
    list === 'TOP_VOLUME_CREATORS_24H' ||
    list === 'FEATURED_CREATORS' ||
    list === 'TRENDING_CREATORS'
  )
}

type CreatorEthosResolved = {
  creatorAddress: string
  twitterUsername: string | null
  score: number | null
  level: string | null
}

async function resolveCreatorEthosByAddress(creatorAddresses: string[]): Promise<Map<string, CreatorEthosResolved>> {
  const normalizedAddresses = Array.from(
    new Set(
      creatorAddresses
        .map((address) => String(address || '').trim().toLowerCase())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  )
  if (normalizedAddresses.length === 0) return new Map()

  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const rows = await db.sql`
    WITH input AS (
      SELECT unnest(${normalizedAddresses}::text[]) AS creator_address
    ),
    profile_identity AS (
      SELECT
        i.creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY i.creator_address
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM input i
      JOIN zora_profiles p
        ON lower(i.creator_address) = lower(NULLIF(p.signing_eoa, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.primary_wallet, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.payout_recipient, ''))
    ),
    profile_best AS (
      SELECT creator_address, twitter_username
      FROM profile_identity
      WHERE rn = 1
    )
    SELECT
      i.creator_address,
      pb.twitter_username,
      es_social.score AS social_score,
      es_social.level AS social_level,
      es_wallet.score AS wallet_score,
      es_wallet.level AS wallet_level
    FROM input i
    LEFT JOIN profile_best pb
      ON pb.creator_address = i.creator_address
    LEFT JOIN ethos_userkey_scores es_social
      ON pb.twitter_username IS NOT NULL
      AND es_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      AND es_social.status = 'matched'
    LEFT JOIN ethos_userkey_scores es_wallet
      ON es_wallet.ethos_userkey = ('address:' || i.creator_address)
      AND es_wallet.status = 'matched';
  `

  const typed = (rows.rows ?? []) as Array<{
    creator_address: string
    twitter_username: string | null
    social_score: number | null
    social_level: string | null
    wallet_score: number | null
    wallet_level: string | null
  }>

  const socialUserkeys = Array.from(
    new Set(
      typed
        .map((row) => (typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : ''))
        .filter((username) => username.length > 0)
        .map((username) => `service:x.com:username:${username}`),
    ),
  )
  const socialFreshMap = socialUserkeys.length > 0 ? await fetchFreshEthosScoresByUserkeys(socialUserkeys) : new Map()

  const out = new Map<string, CreatorEthosResolved>()
  for (const row of typed) {
    const creatorAddress = String(row.creator_address).toLowerCase()
    const twitterUsername = typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : null
    const socialFresh = twitterUsername ? socialFreshMap.get(`service:x.com:username:${twitterUsername}`) ?? null : null
    const score = typeof socialFresh?.score === 'number'
      ? socialFresh.score
      : typeof row.social_score === 'number'
        ? row.social_score
        : typeof row.wallet_score === 'number'
          ? row.wallet_score
          : null
    const level = typeof socialFresh?.level === 'string'
      ? socialFresh.level
      : row.social_level ?? row.wallet_level ?? null
    out.set(creatorAddress, {
      creatorAddress,
      twitterUsername,
      score,
      level,
    })
  }

  return out
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
    ),
    profile_identity AS (
      SELECT
        lower(a.address) AS creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY lower(a.address)
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM zora_profiles p
      CROSS JOIN LATERAL (
        SELECT NULLIF(p.signing_eoa, '') AS address
        UNION ALL
        SELECT NULLIF(p.primary_wallet, '')
        UNION ALL
        SELECT NULLIF(p.payout_recipient, '')
      ) a
      WHERE a.address IS NOT NULL
    ),
    profile_best AS (
      SELECT creator_address, twitter_username
      FROM profile_identity
      WHERE rn = 1
    )
    SELECT
      rcc.coin_address,
      rcc.creator_address,
      pb.twitter_username,
      rcc.created_at,
      rcc.market_cap_usd,
      rcc.volume_24h_usd,
      COALESCE(es_social.score, es_wallet.score) AS ethos_score,
      COALESCE(es_social.level, es_wallet.level) AS ethos_level
    FROM ranked_creator_coins rcc
    LEFT JOIN profile_best pb
      ON pb.creator_address = rcc.creator_address
    LEFT JOIN ethos_userkey_scores es_social
      ON pb.twitter_username IS NOT NULL
      AND es_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      AND es_social.status = 'matched'
    LEFT JOIN ethos_userkey_scores es_wallet
      ON es_wallet.ethos_userkey = ('address:' || rcc.creator_address)
      AND es_wallet.status = 'matched'
    WHERE rcc.creator_coin_rank = 1
      AND (${params.ethosMin}::numeric IS NULL OR COALESCE(es_social.score, es_wallet.score) >= ${params.ethosMin})
    ORDER BY
      CASE WHEN COALESCE(es_social.score, es_wallet.score) IS NULL THEN 1 ELSE 0 END ASC,
      COALESCE(es_social.score, es_wallet.score) DESC NULLS LAST,
      rcc.volume_24h_usd DESC NULLS LAST,
      rcc.market_cap_usd DESC NULLS LAST,
      rcc.creator_address ASC
    OFFSET ${offset}
    LIMIT ${limitPlusOne};
  `

  const selected = (rows.rows ?? []) as Array<{
    coin_address: string
    creator_address: string
    twitter_username: string | null
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

  const creatorEthosMap = await resolveCreatorEthosByAddress(pageRows.map((row) => row.creator_address))

  const edges = pageRows.map((row, idx) => {
    const detail = coinDetails.get(String(row.coin_address).toLowerCase()) ?? null
    const address = String(row.coin_address).toLowerCase()
    const creatorAddress = String(row.creator_address).toLowerCase()
    const displayName = typeof detail?.name === 'string' && detail.name.trim() ? detail.name.trim() : shortSymbol(address)
    const displaySymbol = typeof detail?.symbol === 'string' && detail.symbol.trim() ? detail.symbol.trim() : shortSymbol(address)
    const marketCap = toNumericString(detail?.marketCap) ?? toNumericString(row.market_cap_usd)
    const volume24h = toNumericString(detail?.volume24h) ?? toNumericString(row.volume_24h_usd)
    const creatorProfile = detail?.creatorProfile
    const resolvedEthos = creatorEthosMap.get(creatorAddress) ?? null
    const finalScore = typeof resolvedEthos?.score === 'number'
      ? resolvedEthos.score
      : typeof row.ethos_score === 'number'
        ? row.ethos_score
        : null
    const finalLevel = resolvedEthos?.level ?? row.ethos_level ?? null
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
        ethosScore: finalScore,
        ethosLevel: finalLevel,
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

  if (sort === 'ETHOS_SCORE' && (list === 'NEW_CREATORS' || list === 'MOST_VALUABLE_CREATORS' || list === 'TOP_VOLUME_CREATORS_24H')) {
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
    if (isCreatorList(list)) {
      const edges = Array.isArray(data?.edges) ? data.edges : []
      const creatorAddresses = edges
        .map((edge: any) => edge?.node?.creatorAddress)
        .filter((value: unknown): value is string => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value))
        .map((address: string) => address.toLowerCase())
      const creatorEthosMap = await resolveCreatorEthosByAddress(creatorAddresses)

      for (const edge of edges) {
        if (!edge?.node || typeof edge.node !== 'object') continue
        const creatorAddress = typeof edge.node.creatorAddress === 'string' ? edge.node.creatorAddress.toLowerCase() : ''
        const resolvedEthos = creatorEthosMap.get(creatorAddress)
        if (!resolvedEthos) continue
        edge.node.ethosScore = resolvedEthos.score
        edge.node.ethosLevel = resolvedEthos.level
      }
    }

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


