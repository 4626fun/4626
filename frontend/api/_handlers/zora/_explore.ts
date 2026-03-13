import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'

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

function normalizeExploreResponse(response: any) {
  if (response?.data?.edges || response?.data?.pageInfo) return response.data
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
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
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined

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


