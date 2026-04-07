// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistEntryPath,
  buildWaitlistEntryUrl,
  buildWaitlistReferralPath,
  buildWaitlistReferralUrl,
  clearStoredWaitlistReferralCode,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
  normalizeWaitlistReferralCode,
  readStoredWaitlistReferralCode,
  readWaitlistEntryReferralCode,
  storeWaitlistReferralCode,
} from './waitlistEntry'

describe('waitlistEntry', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('builds the canonical waitlist entry path as a clean route', () => {
    expect(buildWaitlistEntryPath()).toBe('/waitlist')
  })

  it('builds waitlist entry URLs against the provided base origin', () => {
    expect(buildWaitlistEntryUrl('https://4626.fun')).toBe('https://4626.fun/waitlist')
    expect(buildWaitlistEntryUrl('https://v1.4626.fun/')).toBe('https://v1.4626.fun/waitlist')
  })

  it('builds the canonical marketing waitlist path and URL', () => {
    expect(getCanonicalMarketingWaitlistPath()).toBe('/waitlist')
    expect(buildCanonicalMarketingWaitlistUrl('https://4626.fun/')).toBe('https://4626.fun/waitlist')
  })

  it('normalizes referral codes into short url-safe values', () => {
    expect(normalizeWaitlistReferralCode(' friend-42 ')).toBe('FRIEND42')
    expect(normalizeWaitlistReferralCode('')).toBeNull()
  })

  it('builds clean referral waitlist routes', () => {
    expect(buildWaitlistReferralPath('friend-42')).toBe('/r/FRIEND42')
    expect(buildWaitlistReferralUrl('https://4626.fun', 'friend-42')).toBe('https://4626.fun/r/FRIEND42')
  })

  it('reads referral codes from clean invite routes', () => {
    expect(readWaitlistEntryReferralCode({ pathname: '/r/friend-42' })).toBe('FRIEND42')
    expect(readWaitlistEntryReferralCode({ pathname: '/' })).toBeNull()
  })

  it('treats the /waitlist route as the live marketing waitlist surface', () => {
    expect(isMarketingWaitlistEntryLocation({ pathname: '/waitlist' })).toBe(true)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/r/FRIEND42' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/faq' })).toBe(false)
  })

  it('stores and clears referral codes in session storage', () => {
    expect(readStoredWaitlistReferralCode()).toBeNull()
    storeWaitlistReferralCode('friend-42')
    expect(readStoredWaitlistReferralCode()).toBe('FRIEND42')
    clearStoredWaitlistReferralCode()
    expect(readStoredWaitlistReferralCode()).toBeNull()
  })
})
