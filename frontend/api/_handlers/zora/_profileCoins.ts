import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEFAULT_CHAIN_ID, getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'

const PAGE_LIMIT = 50
const MAX_TOTAL_COUNT = 1000

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

  const identifier = getStringQuery(req, 'identifier')
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Identifier is required' })
  }

  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), MAX_TOTAL_COUNT)
  const after = getStringQuery(req, 'after') ?? undefined

  // Default to Base-only coins for 4626.
  const chainIds = [DEFAULT_CHAIN_ID]

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    let nextAfter = after
    let remaining = count
    let aggregatedProfile: any = null
    let aggregatedEdges: any[] = []
    let lastPageInfo: { hasNextPage?: boolean; endCursor?: string } | undefined

    do {
      const pageSize = Math.min(remaining, PAGE_LIMIT)
      const response = await sdk.getProfileCoins({
        identifier,
        count: pageSize,
        after: nextAfter,
        chainIds,
      })

      const profile = response.data?.profile ?? null
      if (!aggregatedProfile) aggregatedProfile = profile

      const createdCoins = profile?.createdCoins ?? null
      const edges = Array.isArray(createdCoins?.edges) ? createdCoins.edges : []
      aggregatedEdges = aggregatedEdges.concat(edges)
      lastPageInfo = createdCoins?.pageInfo
      remaining = Math.max(0, count - aggregatedEdges.length)
      nextAfter = typeof createdCoins?.pageInfo?.endCursor === 'string' ? createdCoins.pageInfo.endCursor : undefined

      if (!createdCoins?.pageInfo?.hasNextPage || edges.length === 0 || remaining === 0) break
    } while (remaining > 0)

    if (aggregatedProfile?.createdCoins) {
      aggregatedProfile = {
        ...aggregatedProfile,
        createdCoins: {
          ...aggregatedProfile.createdCoins,
          edges: aggregatedEdges.slice(0, count),
          pageInfo: {
            hasNextPage: Boolean(lastPageInfo?.hasNextPage && aggregatedEdges.length < count),
            endCursor: lastPageInfo?.endCursor,
          },
          count: aggregatedEdges.length,
        },
      }
    }

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: aggregatedProfile ?? null,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch profile coins',
    })
  }
}

