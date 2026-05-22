import { describe, expect, it } from 'vitest'

import {
  buildExploreHeroStatusLine,
  preferLiveMetricValue,
} from '@/features/explore/exploreCreatorsMetrics'

describe('exploreCreatorsMetrics', () => {
  it('prefers the higher live/canonical metric when both are present', () => {
    expect(preferLiveMetricValue(5733, 497_298)).toBe(497_298)
    expect(preferLiveMetricValue(null, 1200)).toBe(1200)
    expect(preferLiveMetricValue(11_000_000, null)).toBe(11_000_000)
  })

  it('builds indexed status copy with live financial note', () => {
    const line = buildExploreHeroStatusLine({
      updatedAt: '2026-05-22T12:00:00.000Z',
      exact: false,
      syncStatus: 'running',
      creatorsTotal: 30_180,
      syncMeta: { driftEstimateTotal: null } as any,
      usingLiveFinancials: true,
    })

    expect(line).toContain('Indexed 30,180 creators')
    expect(line).toContain('live vol/fees from Zora')
  })
})
