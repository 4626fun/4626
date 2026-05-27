import { describe, expect, it } from 'vitest'

import { resolveCanonicalScoreDisplay } from './canonicalAccountScore'

describe('resolveCanonicalScoreDisplay', () => {
  it('prefers session score over position fallback', () => {
    const display = resolveCanonicalScoreDisplay({
      score: { points: 382, tier: 3, amoeCredits: 225 },
      positionWaitlistTotal: 225,
    })
    expect(display.waitlistPoints).toBe(382)
    expect(display.amoeCredits).toBe(225)
    expect(display.showLotteryCreditsNote).toBe(true)
  })

  it('uses position total only when score is absent', () => {
    const display = resolveCanonicalScoreDisplay({
      positionWaitlistTotal: 382,
    })
    expect(display.waitlistPoints).toBe(382)
    expect(display.amoeCredits).toBe(382)
    expect(display.showLotteryCreditsNote).toBe(false)
  })
})
