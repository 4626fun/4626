import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_explore.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  requireServerKeyMock,
  sdkSetApiKeyMock,
  getExploreTopVolumeCreators24hMock,
} = vi.hoisted(() => ({
  requireServerKeyMock: vi.fn(),
  sdkSetApiKeyMock: vi.fn(),
  getExploreTopVolumeCreators24hMock: vi.fn(),
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
  getCoinsTopGainers: vi.fn(),
  getCoinsTopVolume24h: vi.fn(),
  getCoinsMostValuable: vi.fn(),
  getCoinsNew: vi.fn(),
  getCoinsLastTraded: vi.fn(),
  getCoinsLastTradedUnique: vi.fn(),
  getCreatorCoins: vi.fn(),
  getMostValuableCreatorCoins: vi.fn(),
  getExploreTopVolumeCreators24h: getExploreTopVolumeCreators24hMock,
  getExploreFeaturedCreators: vi.fn(),
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
})
