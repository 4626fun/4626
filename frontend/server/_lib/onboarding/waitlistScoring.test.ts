import { describe, expect, it } from 'vitest'

import { weightedAmoeEligiblePoints, weightedWaitlistPoints, sumWaitlistPointsBreakdown } from './waitlistScoring.js'
import type { WaitlistPointsBreakdown } from './waitlistScoring.js'

describe('weightedWaitlistPoints', () => {
  it('counts referral_passthrough at full weight', () => {
    expect(weightedWaitlistPoints('referral_passthrough', 4)).toBe(4)
  })

  it('weights legacy referral milestones at 0.60', () => {
    expect(weightedWaitlistPoints('referral_signup', 10)).toBe(6)
  })

  it('excludes AMOE lottery bookkeeping sources from waitlist totals', () => {
    expect(weightedWaitlistPoints('amoe_xmtp_daily', 100)).toBe(0)
    expect(weightedWaitlistPoints('amoe_entry_spend', -50)).toBe(0)
    expect(weightedWaitlistPoints('amoe_twitter_daily', 34)).toBe(0)
  })

  it('includes bridged amoe_checkin on canonical profiles', () => {
    expect(weightedWaitlistPoints('amoe_checkin', 6)).toBe(6)
  })
})

describe('weightedAmoeEligiblePoints', () => {
  it('excludes referral_passthrough from legacy AMOE view weights', () => {
    expect(weightedAmoeEligiblePoints('referral_passthrough', 40)).toBe(0)
  })

  it('counts daily AMOE credits in legacy AMOE view weights', () => {
    expect(weightedAmoeEligiblePoints('amoe_twitter_daily', 1)).toBe(1)
  })
})

describe('sumWaitlistPointsBreakdown', () => {
  it('sums all overview buckets', () => {
    const breakdown: WaitlistPointsBreakdown = {
      total: 225,
      invite: 12,
      signup: 10,
      links: 18,
      tasks: 3,
      csw: 20,
      social: 8,
      checkins: 150,
      bonus: 4,
      agent: 0,
    }
    expect(sumWaitlistPointsBreakdown(breakdown)).toBe(225)
  })
})

describe('readAmoeEligibleCreditsForSignupId', () => {
  it('includes referral_passthrough because it delegates to waitlist breakdown', () => {
    expect(weightedWaitlistPoints('referral_passthrough', 40)).toBe(40)
  })
})
