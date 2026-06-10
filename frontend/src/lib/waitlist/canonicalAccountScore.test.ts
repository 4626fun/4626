import { describe, expect, it } from 'vitest'

import { resolvePublicPointsDisplay } from './canonicalAccountScore'

describe('resolvePublicPointsDisplay', () => {
  it('prefers session score over position fallback', () => {
    const display = resolvePublicPointsDisplay({
      score: { points: 225, tier: 2 },
      positionTotal: 200,
    })
    expect(display.points).toBe(225)
    expect(display.tier).toBe(2)
  })

  it('uses position total only when score is absent', () => {
    const display = resolvePublicPointsDisplay({
      positionTotal: 225,
    })
    expect(display.points).toBe(225)
  })
})
