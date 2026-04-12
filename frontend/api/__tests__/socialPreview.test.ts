import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../social-preview'
import { createMockReq, createMockRes } from './helpers'

const {
  createPublicClientMock,
  httpMock,
  sdkSetApiKeyMock,
  sdkGetCoinMock,
  sdkGetTopVolumeCreatorsMock,
  sdkGetTrendingPostsMock,
  sdkGetTopVolumeTrendsMock,
  sdkGetMostValuableTrendsMock,
  sdkGetTrendingTrendsMock,
  sdkGetNewTrendsMock,
} = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  httpMock: vi.fn(() => ({})),
  sdkSetApiKeyMock: vi.fn(),
  sdkGetCoinMock: vi.fn(),
  sdkGetTopVolumeCreatorsMock: vi.fn(),
  sdkGetTrendingPostsMock: vi.fn(),
  sdkGetTopVolumeTrendsMock: vi.fn(),
  sdkGetMostValuableTrendsMock: vi.fn(),
  sdkGetTrendingTrendsMock: vi.fn(),
  sdkGetNewTrendsMock: vi.fn(),
}))

vi.mock('viem', () => ({
  createPublicClient: createPublicClientMock,
  http: httpMock,
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: sdkSetApiKeyMock,
  getCoin: sdkGetCoinMock,
  getExploreTopVolumeCreators24h: sdkGetTopVolumeCreatorsMock,
  getTrendingPosts: sdkGetTrendingPostsMock,
  getTopVolumeTrends24h: sdkGetTopVolumeTrendsMock,
  getMostValuableTrends: sdkGetMostValuableTrendsMock,
  getTrendingTrends: sdkGetTrendingTrendsMock,
  getNewTrends: sdkGetNewTrendsMock,
}))

describe('GET /api/social-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ZORA_SERVER_API_KEY', 'test-zora-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders creator detail unfurl metadata for social bots', async () => {
    const creatorAddress = '0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59'
    sdkGetCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          name: 'AKITA Creator Coin',
          symbol: 'AKITA',
          description: 'Creator coin for AKITA community.',
          creatorProfile: {
            handle: 'akita',
          },
        },
      },
    })

    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
        'x-forwarded-proto': 'https',
      },
      query: {
        kind: 'creator',
        chain: 'base',
        address: creatorAddress,
      },
      url: '/api/social-preview',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type'))).toContain('text/html')
    const html = String(res.body)
    expect(html).toContain('AKITA Creator Coin (AKITA) - Creator on 4626')
    expect(html).toContain('/api/token/image?address=0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59')
    expect(html).toContain('tokenKind=creator')
    expect(html).toContain('https://app.4626.fun/explore/creators/base/0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59')
    expect(sdkSetApiKeyMock).toHaveBeenCalledWith('test-zora-key')
    expect(sdkGetCoinMock).toHaveBeenCalled()
  })

  it('renders trends unfurl metadata with live top trend token image', async () => {
    sdkGetMostValuableTrendsMock.mockResolvedValue({
      data: {
        edges: [
          {
            node: {
              address: '0x1111111111111111111111111111111111111111',
              symbol: 'TREND',
            },
          },
        ],
      },
    })

    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
        'x-forwarded-proto': 'https',
      },
      query: {
        kind: 'trends',
        sort: 'marketCap',
        time: '1w',
      },
      url: '/api/social-preview',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const html = String(res.body)
    expect(html).toContain('Top Trends on Base - 4626')
    expect(html).toContain('Live 7d market cap trends on Base. Leading now: TREND.')
    expect(html).toContain('/api/token/image?address=0x1111111111111111111111111111111111111111')
    expect(html).toContain('https://app.4626.fun/explore/trends?sort=marketCap&amp;time=1w')
    expect(sdkGetMostValuableTrendsMock).toHaveBeenCalled()
  })

  it('renders vault detail unfurl metadata from onchain vault wiring', async () => {
    const vaultAddress = '0x2222222222222222222222222222222222222222'
    const creatorToken = '0x3333333333333333333333333333333333333333'
    const gauge = '0x4444444444444444444444444444444444444444'
    const shareOft = '0x5555555555555555555555555555555555555555'
    let symbolReadCount = 0

    createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'CREATOR_COIN') return creatorToken
        if (functionName === 'gaugeController') return gauge
        if (functionName === 'shareOFT') return shareOft
        if (functionName === 'symbol') {
          symbolReadCount += 1
          return symbolReadCount === 1 ? 'AKITA' : 'sAKITA'
        }
        return null
      }),
    })

    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
        'x-forwarded-proto': 'https',
      },
      query: {
        kind: 'vault',
        address: vaultAddress,
      },
      url: '/api/social-preview',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const html = String(res.body)
    expect(html).toContain('AKITA Vault - 4626')
    expect(html).toContain('/api/token/image?address=0x5555555555555555555555555555555555555555')
    expect(html).toContain('tokenKind=share')
    expect(html).toContain('https://app.4626.fun/vault/0x2222222222222222222222222222222222222222')
    expect(createPublicClientMock).toHaveBeenCalled()
  })
})
