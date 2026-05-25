import { describe, expect, it } from 'vitest'

import { buildSparklineFromDailyCloses } from './tokenPoolHistorySeries.js'

describe('buildSparklineFromDailyCloses', () => {
  it('derives percent change from chronological daily closes', () => {
    const result = buildSparklineFromDailyCloses([1, 1.1, 1.25])
    expect(result.values).toEqual([1, 1.1, 1.25])
    expect(result.changePercent).toBeCloseTo(25, 5)
  })

  it('returns empty when fewer than two valid closes exist', () => {
    expect(buildSparklineFromDailyCloses([1])).toEqual({ values: [], changePercent: null })
    expect(buildSparklineFromDailyCloses([])).toEqual({ values: [], changePercent: null })
  })
})
