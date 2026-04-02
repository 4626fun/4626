import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  setApiKeyMock,
  getExploreListMock,
  getProfileMock,
  getCoinMock,
  getProfileCoinsMock,
  getCoinSwapsMock,
} = vi.hoisted(() => ({
  setApiKeyMock: vi.fn(),
  getExploreListMock: vi.fn(),
  getProfileMock: vi.fn(),
  getCoinMock: vi.fn(),
  getProfileCoinsMock: vi.fn(),
  getCoinSwapsMock: vi.fn(),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: setApiKeyMock,
  getExploreList: getExploreListMock,
  getProfile: getProfileMock,
  getCoin: getCoinMock,
  getProfileCoins: getProfileCoinsMock,
  getCoinSwaps: getCoinSwapsMock,
}))

describe('server/zora/cliCompat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ZORA_SERVER_API_KEY
  })

  it('maps explore list results to CLI coin shape', async () => {
    const { exploreCli } = await import('./cliCompat')
    getExploreListMock.mockResolvedValueOnce({
      data: {
        edges: [
          {
            node: {
              name: 'Akita Coin',
              address: '0x1111111111111111111111111111111111111111',
              coinType: 'CREATOR',
              symbol: 'AKITA',
              marketCap: '123.45',
              volume24h: '67.89',
              uniqueHolders: 12,
              createdAt: '2026-01-01T00:00:00.000Z',
              creatorProfile: { handle: 'akita' },
            },
          },
        ],
        pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
      },
    })

    const result = await exploreCli({
      serverKey: 'test-zora-key',
      sort: 'trending',
      type: 'creator-coin',
      limit: 5,
      cursor: null,
    })

    expect(setApiKeyMock).toHaveBeenCalledWith('test-zora-key')
    expect(getExploreListMock).toHaveBeenCalledWith('TRENDING_CREATORS', {
      count: 5,
      after: undefined,
    })
    expect(result).toEqual({
      coins: [
        {
          name: 'Akita Coin',
          address: '0x1111111111111111111111111111111111111111',
          coinType: 'creator-coin',
          symbol: 'AKITA',
          marketCap: '123.45',
          volume24h: '67.89',
          uniqueHolders: 12,
          createdAt: '2026-01-01T00:00:00.000Z',
          creatorHandle: 'akita',
        },
      ],
      nextCursor: 'cursor-1',
    })
  })

  it('resolves creator-handle lookups before getCoin', async () => {
    const { getCliCoin } = await import('./cliCompat')
    getProfileMock.mockResolvedValueOnce({
      data: {
        profile: {
          creatorCoin: { address: '0x2222222222222222222222222222222222222222' },
        },
      },
    })
    getCoinMock.mockResolvedValueOnce({
      data: {
        zora20Token: {
          name: 'Creator Coin',
          address: '0x2222222222222222222222222222222222222222',
          coinType: 'CREATOR',
          symbol: 'CRT',
          marketCap: '42',
          volume24h: '3',
          uniqueHolders: 9,
          createdAt: '2026-02-01T00:00:00.000Z',
          creatorProfile: { handle: 'akita' },
        },
      },
    })

    const result = await getCliCoin({
      serverKey: 'test-zora-key',
      reference: 'akita',
      coinType: 'creator-coin',
    })

    expect(getProfileMock).toHaveBeenCalledWith({ identifier: 'akita' })
    expect(getCoinMock).toHaveBeenCalledWith({
      address: '0x2222222222222222222222222222222222222222',
      chain: 8453,
    })
    expect(result.coinType).toBe('creator-coin')
  })

  it('builds price history from swap activity points', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'))
    const { priceHistoryCli } = await import('./cliCompat')
    getCoinMock.mockResolvedValueOnce({
      data: {
        zora20Token: {
          name: 'Post Coin',
          address: '0x3333333333333333333333333333333333333333',
          coinType: 'CONTENT',
        },
      },
    })
    getCoinSwapsMock.mockResolvedValueOnce({
      data: {
        zora20Token: {
          swapActivities: {
            edges: [
              {
                node: {
                  blockTimestamp: '2026-03-31T08:00:00.000Z',
                  currencyAmountWithPrice: { priceUsdc: '1.0' },
                },
              },
              {
                node: {
                  blockTimestamp: '2026-03-31T10:00:00.000Z',
                  currencyAmountWithPrice: { priceUsdc: '2.0' },
                },
              },
            ],
          },
        },
      },
    })

    const result = await priceHistoryCli({
      serverKey: 'test-zora-key',
      reference: '0x3333333333333333333333333333333333333333',
      interval: '24h',
    })

    expect(result.coin).toEqual({
      name: 'Post Coin',
      address: '0x3333333333333333333333333333333333333333',
      coinType: 'post',
    })
    expect(result.interval).toBe('24h')
    expect(result.high).toBe(2)
    expect(result.low).toBe(1)
    expect(result.change).toBe(100)
    expect(result.prices).toHaveLength(2)
    vi.useRealTimers()
  })

  it('reports auth status from ZORA_SERVER_API_KEY', async () => {
    const { authStatusCli } = await import('./cliCompat')
    process.env.ZORA_SERVER_API_KEY = 'abcdefghijklmnopqrstuvwxyz'

    const result = authStatusCli()

    expect(result).toEqual({
      authenticated: true,
    })
  })

  it('normalizes unknown errors into CLI error payloads', async () => {
    const { toCliErrorPayload } = await import('./cliCompat')
    const result = toCliErrorPayload(new Error('boom'), 'retry later')
    expect(result).toEqual({
      status: 500,
      body: {
        error: 'boom',
        suggestion: 'retry later',
      },
    })
  })
})
