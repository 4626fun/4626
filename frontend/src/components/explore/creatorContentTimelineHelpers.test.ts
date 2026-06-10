import { describe, expect, it } from 'vitest'

import type { ZoraCoin } from '@/lib/zora/types'

import {
  formatTimelineDateParts,
  groupTimelineCoinsByYear,
  resolveTimelineSide,
} from './creatorContentTimelineHelpers'

describe('creatorContentTimelineHelpers', () => {
  it('formats posted dates with full and relative labels', () => {
    const parts = formatTimelineDateParts('2026-03-08T12:00:00.000Z')
    expect(parts.monthDay).toMatch(/Mar/)
    expect(parts.year).toBe('2026')
    expect(parts.full).toContain('2026')
    expect(parts.relative.length).toBeGreaterThan(0)
  })

  it('groups timeline coins by publish year', () => {
    const coins: ZoraCoin[] = [
      { id: 'a', createdAt: '2026-03-08T00:00:00.000Z' },
      { id: 'b', createdAt: '2025-11-02T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-01-04T00:00:00.000Z' },
    ]

    expect(groupTimelineCoinsByYear(coins)).toEqual([
      { year: '2026', items: [coins[0], coins[2]] },
      { year: '2025', items: [coins[1]] },
    ])
  })

  it('alternates timeline card sides', () => {
    expect(resolveTimelineSide(0)).toBe('right')
    expect(resolveTimelineSide(1)).toBe('left')
    expect(resolveTimelineSide(2)).toBe('right')
  })
})
