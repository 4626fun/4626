import { describe, expect, it } from 'vitest'

import { resolveExploreRowTrend30d } from './exploreTableSparklines'

describe('resolveExploreRowTrend30d', () => {
  it('prefers hook map over inline coin trend30d', () => {
    const map = new Map([
      [
        '0xabc',
        {
          values: [2, 3],
          changePercent: 50,
        },
      ],
    ])
    const result = resolveExploreRowTrend30d(
      {
        address: '0xAbC',
        trend30d: { values: [1, 1.1], changePercent: 10 },
      },
      map,
    )
    expect(result?.values).toEqual([2, 3])
  })

  it('falls back to inline coin trend30d when map is empty', () => {
    const result = resolveExploreRowTrend30d(
      {
        address: '0xabc',
        trend30d: { values: [1, 1.1], changePercent: 10 },
      },
      new Map(),
    )
    expect(result?.values).toEqual([1, 1.1])
  })
})
