import { describe, expect, it } from 'vitest'

import { weightedAmoeEligiblePoints, weightedWaitlistPoints } from './waitlistScoring.js'

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
  it('excludes referral_passthrough from lottery credits', () => {
    expect(weightedAmoeEligiblePoints('referral_passthrough', 40)).toBe(0)
  })

  it('counts daily AMOE credits toward lottery balance', () => {
    expect(weightedAmoeEligiblePoints('amoe_twitter_daily', 1)).toBe(1)
  })
})
