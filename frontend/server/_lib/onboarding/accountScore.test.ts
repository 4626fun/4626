import { describe, expect, it } from 'vitest'

import {
  buildAccountScoreFromBreakdown,
  normalizeAccountScore,
  waitlistTierFromPoints,
} from './accountScore.js'

describe('normalizeAccountScore', () => {
  it('clamps invalid values and realigns tier to waitlist points', () => {
    const score = normalizeAccountScore({ points: 382.9, tier: 0, amoeCredits: 225 })
    expect(score).toEqual({
      points: 382,
      tier: 3,
      amoeCredits: 225,
      lotteryCreditsDiffer: true,
    })
  })

  it('does not mark lottery note when credits match waitlist total', () => {
    const score = normalizeAccountScore({ points: 120, tier: 2, amoeCredits: 120 })
    expect(score.lotteryCreditsDiffer).toBe(false)
  })
})

describe('buildAccountScoreFromBreakdown', () => {
  it('uses breakdown total as canonical waitlist points', () => {
    const score = buildAccountScoreFromBreakdown(
      { total: 382, invite: 100, signup: 10, tasks: 0, csw: 50, social: 0, bonus: 0 },
      225,
    )
    expect(score.points).toBe(382)
    expect(score.amoeCredits).toBe(225)
    expect(score.tier).toBe(waitlistTierFromPoints(382))
  })
})
