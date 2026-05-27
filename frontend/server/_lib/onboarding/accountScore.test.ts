import { describe, expect, it } from 'vitest'

import {
  buildAccountScoreFromBreakdown,
  normalizeAccountScore,
  waitlistTierFromPoints,
} from './accountScore.js'

describe('normalizeAccountScore', () => {
  it('clamps invalid values and realigns tier to waitlist points', () => {
    const score = normalizeAccountScore({ points: 382.9, tier: 0 })
    expect(score).toEqual({
      points: 382,
      tier: 3,
    })
  })
})

describe('buildAccountScoreFromBreakdown', () => {
  it('uses breakdown total as canonical public points', () => {
    const score = buildAccountScoreFromBreakdown({
      total: 225,
      invite: 100,
      signup: 10,
      tasks: 0,
      csw: 50,
      social: 0,
      bonus: 0,
    })
    expect(score.points).toBe(225)
    expect(score.tier).toBe(waitlistTierFromPoints(225))
  })
})
