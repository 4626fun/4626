import { describe, expect, it } from 'vitest'

import { dedupeReferralCodeCandidates, normalizeReferralCode, referralCodeFromEmail } from './referrals'

describe('referrals helpers', () => {
  it('derives referral codes from email usernames', () => {
    expect(referralCodeFromEmail('hello@4626.fun')).toBe('HELLO')
    expect(referralCodeFromEmail('')).toBeNull()
  })

  it('dedupes and normalizes referral candidates in order', () => {
    expect(
      dedupeReferralCodeCandidates(['$akita', 'akita', '4626dotfun', null, ' C2 ']),
    ).toEqual(['AKITA', '4626DOTFUN', 'C2'])
  })

  it('keeps referral normalization url-safe and short', () => {
    expect(normalizeReferralCode('$akita-launch-token')).toBe('AKITALAUNCHTOKEN')
  })
})
