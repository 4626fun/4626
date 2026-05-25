import { describe, expect, it, vi } from 'vitest'

import { hydrateExploreSparklinesOnEdges } from './exploreSparklineHydrate.js'

vi.mock('./coinPriceSparkline.js', () => ({
  resolveCoinPriceSparkline: vi.fn(),
}))

vi.mock('./exploreSparklineCache.js', () => ({
  persistExploreSparklinesToDb: vi.fn(async () => undefined),
}))

import { resolveCoinPriceSparkline } from './coinPriceSparkline.js'

describe('hydrateExploreSparklinesOnEdges', () => {
  it('skips edges that already have trend30d', async () => {
    const db = {} as any
    const edges = [
      {
        node: {
          address: '0x1111111111111111111111111111111111111111',
          trend30d: { values: [1, 2], changePercent: 100 },
        },
      },
    ]

    const result = await hydrateExploreSparklinesOnEdges(db, edges, { sdk: {} })
    expect(result).toEqual({ hydrated: 0, attempted: 0 })
    expect(resolveCoinPriceSparkline).not.toHaveBeenCalled()
  })

  it('hydrates missing trend30d on visible edges', async () => {
    vi.mocked(resolveCoinPriceSparkline).mockResolvedValueOnce({
      coinAddress: '0x2222222222222222222222222222222222222222',
      values: [1, 1.5],
      changePercent: 50,
      source: 'subgraph',
    })

    const db = {} as any
    const edges = [{ node: { address: '0x2222222222222222222222222222222222222222' } }]

    const result = await hydrateExploreSparklinesOnEdges(db, edges, { sdk: {} })
    expect(result).toEqual({ hydrated: 1, attempted: 1 })
    expect(edges[0]?.node?.trend30d).toEqual({ values: [1, 1.5], changePercent: 50 })
  })
})
