import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_explore.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  requireServerKeyMock,
  sdkSetApiKeyMock,
  getDbMock,
  loadCreatorEthosProjectionByAddressesMock,
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
  getCoinMock,
} = vi.hoisted(() => ({
  requireServerKeyMock: vi.fn(),
  sdkSetApiKeyMock: vi.fn(),
  getDbMock: vi.fn(),
  loadCreatorEthosProjectionByAddressesMock: vi.fn(),
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
  getCoinMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/zora/creatorEthosProjection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/_lib/zora/creatorEthosProjection.js')>()
  return {
    ...actual,
    loadCreatorEthosProjectionByAddresses: loadCreatorEthosProjectionByAddressesMock,
  }
})

vi.mock('../../server/_lib/chat/ethosClient.js', () => ({
  fetchFreshEthosScoresByUserkeys: vi.fn(async () => new Map()),
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
  getCoin: getCoinMock,
}))

describe('GET /api/zora/explore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireServerKeyMock.mockReturnValue('test-key')
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({ rows: [] })),
    })
    loadCreatorEthosProjectionByAddressesMock.mockResolvedValue(new Map())
  })

  it('returns creator lists when the SDK response is already a connection shape at data level', async () => {
    getExploreTopVolumeCreators24hMock.mockResolvedValue({
      data: {
        edges: [
          {
            cursor: 'cursor-1',
            node: {
              address: '0x0000000000000000000000000000000000000123',
              creatorAddress: '0x0000000000000000000000000000000000000abc',
              symbol: 'AKITA',
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })

    loadCreatorEthosProjectionByAddressesMock.mockResolvedValue(
      new Map([
        [
          '0x0000000000000000000000000000000000000abc',
          {
            creatorAddress: '0x0000000000000000000000000000000000000abc',
            score: 1650,
            level: 'reputable',
            source: 'owner_class_csw',
          },
        ],
      ]),
    )

    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({ rows: [] })),
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
    expect(res.body?.data?.edges?.[0]?.node?.ethosScore).toBe(1650)
    expect(res.body?.data?.edges?.[0]?.node?.ethosScoreSource).toBe('owner_class_csw')
    expect(loadCreatorEthosProjectionByAddressesMock).toHaveBeenCalled()
  })

  it('serves indexed display parity for Ethos-sorted projection rows without getCoin', async () => {
    getCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          name: 'jesse',
          symbol: 'jesse',
          marketCap: '1200000',
          marketCapDelta24h: '8.4',
          volume24h: '5400',
          uniqueHolders: 999,
          mediaContent: {
            previewImage: { small: 'https://example.com/jesse.png' },
          },
          creatorProfile: {
            handle: 'jessepollak',
            avatar: { previewImage: { small: 'https://example.com/jesse-avatar.png' } },
          },
        },
      },
    })

    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ')
        if (query.includes('to_regclass')) {
          return { rows: [{ has_projection: true }] }
        }
        if (query.includes('creator_ethos_projection')) {
          return {
            rows: [
              {
                creator_address: '0x0000000000000000000000000000000000000abc',
                coin_address: '0x0000000000000000000000000000000000000123',
                twitter_username: 'jessepollak',
                zora_handle: 'jessepollak',
                created_at: '2025-01-01T00:00:00Z',
                market_cap_usd: '1000',
                volume_24h_usd: '100',
                fees_24h_usd: '12.5',
                ethos_score: 1979,
                ethos_level: 'reputable',
                ethos_score_source: 'creator_ethos_projection',
              },
            ],
          }
        }
        if (query.includes('zora_profiles')) {
          return {
            rows: [
              {
                coin_address: '0x0000000000000000000000000000000000000123',
                fees_24h_usd: '12.5',
                coin_unique_holders: 420,
                market_cap_delta_24h: '8.4',
                zora_creator_coin_name: 'jesse',
                zora_creator_coin_symbol: 'jesse',
                profile_unique_holders: 420,
                avatar_image_url: 'https://example.com/jesse-avatar.png',
                zora_handle: 'jessepollak',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

    const req = createMockReq({
      method: 'GET',
      query: { list: 'TOP_VOLUME_CREATORS_24H', sort: 'ETHOS_SCORE', count: '20' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getCoinMock).not.toHaveBeenCalled()
    const node = res.body?.data?.edges?.[0]?.node
    expect(node?.symbol).toBe('jesse')
    expect(node?.name).toBe('jesse')
    expect(node?.ethosScore).toBe(1979)
    expect(node?.fees24hUsd).toBe('12.5')
    expect(node?.uniqueHolders).toBe(420)
    expect(node?.marketCapDelta24h).toBe('8.4')
    expect(node?.mediaContent?.previewImage?.small).toBe('https://example.com/jesse-avatar.png')
    expect(node?.creatorProfile?.handle).toBe('jessepollak')
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
