import { describe, expect, it } from 'vitest'

import { buildExploreHeroStatusLine } from '@/features/explore/exploreCreatorsMetrics'

describe('exploreCreatorsMetrics', () => {
  it('builds indexed status copy for partial sync without live Zora blending', () => {
    const line = buildExploreHeroStatusLine({
      updatedAt: '2026-05-22T12:00:00.000Z',
      exact: false,
      syncStatus: 'running',
      creatorsTotal: 30_180,
      syncMeta: { driftEstimateTotal: null } as any,
    })

    expect(line).toContain('Indexed 30,180 creators')
    expect(line).toContain('Financial totals sum indexed coins only')
    expect(line).not.toContain('Zora')
  })

  it('builds canonical status copy when backfill is complete', () => {
    const line = buildExploreHeroStatusLine({
      updatedAt: '2026-05-22T12:00:00.000Z',
      exact: true,
      syncStatus: 'idle',
      creatorsTotal: 31_441,
      syncMeta: null,
    })

    expect(line).toContain('Indexed totals refreshed')
  })
})
