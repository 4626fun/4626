import { describe, expect, it } from 'vitest'

import {
  buildSparklineLayout,
  extractIndexedMcapSparklineValues,
  layoutToPolyline,
} from '@/components/explore/exploreHeroSparklineUtils'

describe('exploreHeroSparklineUtils', () => {
  it('extracts finite indexed mcap values in order', () => {
    expect(
      extractIndexedMcapSparklineValues([
        { creatorCoinsMarketCapUsd: 100 },
        { creatorCoinsMarketCapUsd: null },
        { creatorCoinsMarketCapUsd: 150 },
      ]),
    ).toEqual([100, 150])
  })

  it('builds a polyline with at least two points', () => {
    const layout = buildSparklineLayout([1_000, 1_200, 900], 72, 28)
    expect(layout).toHaveLength(3)
    expect(layoutToPolyline(layout)).toMatch(/^\d+\.\d+,\d+\.\d+( \d+\.\d+,\d+\.\d+)+$/)
  })
})
