import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getExploreTopVolumeCreators24hMock, getMostValuableCreatorCoinsMock, setApiKeyMock } = vi.hoisted(
  () => ({
    getExploreTopVolumeCreators24hMock: vi.fn(),
    getMostValuableCreatorCoinsMock: vi.fn(),
    setApiKeyMock: vi.fn(),
  }),
)

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: setApiKeyMock,
  getExploreTopVolumeCreators24h: getExploreTopVolumeCreators24hMock,
  getMostValuableCreatorCoins: getMostValuableCreatorCoinsMock,
  getCreatorCoins: vi.fn(),
}))

import {
  fetchZoraExploreFinancialEstimate,
  preferHigherMetric,
  resetZoraExploreFinancialEstimateCacheForTests,
} from './zoraExploreFinancials.js'

describe('zoraExploreFinancials', () => {
  beforeEach(() => {
    resetZoraExploreFinancialEstimateCacheForTests()
    vi.stubEnv('ZORA_METRICS_EXPLORE_CACHE_TTL_MS', '60000')
    getExploreTopVolumeCreators24hMock.mockResolvedValue({
      data: {
        exploreList: {
          edges: [
            {
              node: {
                address: '0x0000000000000000000000000000000000000001',
                creatorAddress: '0x0000000000000000000000000000000000000002',
                volume24h: '1000',
                marketCap: '5000',
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    getMostValuableCreatorCoinsMock.mockResolvedValue({
      data: {
        exploreList: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
  })

  afterEach(() => {
    resetZoraExploreFinancialEstimateCacheForTests()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('prefers the higher canonical or Zora explore metric', () => {
    expect(preferHigherMetric(5733.39, 494592.77)).toBe(494592.77)
    expect(preferHigherMetric(11_028_824.87, 9_500_000)).toBe(11_028_824.87)
    expect(preferHigherMetric(null, 1200)).toBe(1200)
    expect(preferHigherMetric(500, null)).toBe(500)
  })

  it('reuses cached explore financial estimates within TTL', async () => {
    const first = await fetchZoraExploreFinancialEstimate({ apiKey: 'test-key' })
    const second = await fetchZoraExploreFinancialEstimate({ apiKey: 'test-key' })

    expect(first).toEqual(second)
    expect(first?.volume24hUsd).toBe(1000)
    expect(getExploreTopVolumeCreators24hMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when forceRefresh is true', async () => {
    await fetchZoraExploreFinancialEstimate({ apiKey: 'test-key' })
    await fetchZoraExploreFinancialEstimate({ apiKey: 'test-key', forceRefresh: true })

    expect(getExploreTopVolumeCreators24hMock).toHaveBeenCalledTimes(2)
  })
})
