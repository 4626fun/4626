import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_explore.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  requireServerKeyMock,
  sdkSetApiKeyMock,
  getCoinsTopGainersMock,
  getExploreTopVolumeCreators24hMock,
  getExploreTopVolumeAll24hMock,
  getExploreNewAllMock,
  getExploreFeaturedVideosMock,
  getMostValuableAllMock,
  getTrendingAllMock,
  getTrendingCreatorsMock,
  getTrendingPostsMock,
  getTrendingTrendsMock,
  getMostValuableTrendsMock,
  getNewTrendsMock,
  getTopVolumeTrends24hMock,
} = vi.hoisted(() => ({
  requireServerKeyMock: vi.fn(),
  sdkSetApiKeyMock: vi.fn(),
  getCoinsTopGainersMock: vi.fn(),
  getExploreTopVolumeCreators24hMock: vi.fn(),
  getExploreTopVolumeAll24hMock: vi.fn(),
  getExploreNewAllMock: vi.fn(),
  getExploreFeaturedVideosMock: vi.fn(),
  getMostValuableAllMock: vi.fn(),
  getTrendingAllMock: vi.fn(),
  getTrendingCreatorsMock: vi.fn(),
  getTrendingPostsMock: vi.fn(),
  getTrendingTrendsMock: vi.fn(),
  getMostValuableTrendsMock: vi.fn(),
  getNewTrendsMock: vi.fn(),
  getTopVolumeTrends24hMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  getNumberQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  getStringQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptions: vi.fn(() => false),
  requireServerKey: requireServerKeyMock,
  setCache: vi.fn(),
  setCors: vi.fn(),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: sdkSetApiKeyMock,
  getCoinsTopGainers: getCoinsTopGainersMock,
  getCoinsTopVolume24h: vi.fn(),
  getCoinsMostValuable: vi.fn(),
  getCoinsNew: vi.fn(),
  getCoinsLastTraded: vi.fn(),
  getCoinsLastTradedUnique: vi.fn(),
  getCreatorCoins: vi.fn(),
  getMostValuableCreatorCoins: vi.fn(),
  getExploreTopVolumeCreators24h: getExploreTopVolumeCreators24hMock,
  getExploreFeaturedCreators: vi.fn(),
  getExploreTopVolumeAll24h: getExploreTopVolumeAll24hMock,
  getExploreNewAll: getExploreNewAllMock,
  getExploreFeaturedVideos: getExploreFeaturedVideosMock,
  getMostValuableAll: getMostValuableAllMock,
  getTrendingAll: getTrendingAllMock,
  getTrendingCreators: getTrendingCreatorsMock,
  getTrendingPosts: getTrendingPostsMock,
  getTrendingTrends: getTrendingTrendsMock,
  getMostValuableTrends: getMostValuableTrendsMock,
  getNewTrends: getNewTrendsMock,
  getTopVolumeTrends24h: getTopVolumeTrends24hMock,
}))

describe('GET /api/zora/explore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireServerKeyMock.mockReturnValue('test-key')
  })

  it('returns creator lists when the SDK response is already a connection shape at data level', async () => {
    getExploreTopVolumeCreators24hMock.mockResolvedValue({
      data: {
        edges: [
          {
            cursor: 'cursor-1',
            node: { address: '0x123', symbol: 'AKITA' },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })

    const req = createMockReq({
      method: 'GET',
      query: { list: 'TOP_VOLUME_CREATORS_24H', count: '20' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.edges).toHaveLength(1)
    expect(res.body?.data?.edges?.[0]?.node?.symbol).toBe('AKITA')
  })

  it.each([
    { list: 'MOST_VALUABLE_ALL', fn: getMostValuableAllMock },
    { list: 'TRENDING_ALL', fn: getTrendingAllMock },
    { list: 'TRENDING_CREATORS', fn: getTrendingCreatorsMock },
    { list: 'TRENDING_POSTS', fn: getTrendingPostsMock },
    { list: 'TRENDING_TRENDS', fn: getTrendingTrendsMock },
    { list: 'MOST_VALUABLE_TRENDS', fn: getMostValuableTrendsMock },
    { list: 'NEW_TRENDS', fn: getNewTrendsMock },
    { list: 'TOP_VOLUME_TRENDS_24H', fn: getTopVolumeTrends24hMock },
    { list: 'TOP_VOLUME_ALL_24H', fn: getExploreTopVolumeAll24hMock },
    { list: 'NEW_ALL', fn: getExploreNewAllMock },
    { list: 'FEATURED_VIDEOS', fn: getExploreFeaturedVideosMock },
  ])('routes %s to its dedicated SDK wrapper', async ({ list, fn }) => {
    fn.mockResolvedValue({
      data: {
        edges: [{ cursor: 'cursor-1', node: { address: '0xabc', symbol: 'TREND' } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })

    const req = createMockReq({
      method: 'GET',
      query: { list, count: '20' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(fn).toHaveBeenCalledOnce()
    expect(getCoinsTopGainersMock).not.toHaveBeenCalled()
    expect(res.body?.data?.edges).toHaveLength(1)
    expect(res.body?.data?.edges?.[0]?.node?.symbol).toBe('TREND')
  })
})
