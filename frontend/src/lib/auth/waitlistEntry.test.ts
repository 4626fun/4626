// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistEntryPath,
  buildWaitlistEntryUrl,
  buildWaitlistReferralPath,
  buildWaitlistReferralUrl,
  clearStoredWaitlistReferralCode,
  consumeStoredWaitlistAuthArmed,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
  normalizeWaitlistReferralCode,
  readStoredWaitlistReferralCode,
  readStoredWaitlistAuthArmed,
  readWaitlistEntryReferralCode,
  requestStoredWaitlistAuthAutoStart,
  storeWaitlistReferralCode,
  writeStoredWaitlistAuthArmed,
} from './waitlistEntry'

describe('waitlistEntry', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('builds the canonical waitlist entry path as a clean route', () => {
    expect(buildWaitlistEntryPath()).toBe('/')
  })

  it('builds waitlist entry URLs against the provided base origin', () => {
    expect(buildWaitlistEntryUrl('https://4626.fun')).toBe('https://4626.fun/')
    expect(buildWaitlistEntryUrl('https://v1.4626.fun/')).toBe('https://v1.4626.fun/')
  })

  it('builds the canonical marketing waitlist path and URL', () => {
    expect(getCanonicalMarketingWaitlistPath()).toBe('/')
    expect(buildCanonicalMarketingWaitlistUrl('https://4626.fun/')).toBe('https://4626.fun/')
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

  it('treats only the homepage route as the live marketing waitlist surface', () => {
    expect(isMarketingWaitlistEntryLocation({ pathname: '/' })).toBe(true)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/r/FRIEND42' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/waitlist' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/faq' })).toBe(false)
  })

  it('stores and clears referral codes in session storage', () => {
    expect(readStoredWaitlistReferralCode()).toBeNull()
    storeWaitlistReferralCode('friend-42')
    expect(readStoredWaitlistReferralCode()).toBe('FRIEND42')
    clearStoredWaitlistReferralCode()
    expect(readStoredWaitlistReferralCode()).toBeNull()
  })

  it('consumes the armed waitlist entry state once', () => {
    expect(readStoredWaitlistAuthArmed()).toBe(false)
    writeStoredWaitlistAuthArmed(true)
    requestStoredWaitlistAuthAutoStart()
    expect(readStoredWaitlistAuthArmed()).toBe(true)
    expect(consumeStoredWaitlistAuthArmed()).toBe(true)
    expect(readStoredWaitlistAuthArmed()).toBe(false)
  })
})
