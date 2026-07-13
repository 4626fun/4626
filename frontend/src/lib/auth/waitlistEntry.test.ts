// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as host from '@/lib/env/host'
import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistEntryPath,
  buildWaitlistEntryUrl,
  buildWaitlistReferralPath,
  buildWaitlistReferralUrl,
  buildWaitlistSetupPath,
  buildWaitlistSetupUrl,
  buildWaitlistStartAuthPath,
  buildWaitlistStartAuthUrl,
  clearStoredWaitlistReferralCode,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
  isWaitlistStartAuthSearchParam,
  normalizeAlfaClubWaitlistReturnPath,
  normalizeWaitlistReferralCode,
  readWaitlistAlfaClubReturnPath,
  readStoredWaitlistReferralCode,
  readWaitlistEntryReferralCode,
  storeWaitlistReferralCode,
} from './waitlistEntry'

describe('waitlistEntry', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('builds the canonical waitlist entry path as a clean route', () => {
    expect(buildWaitlistEntryPath()).toBe('/waitlist')
  })

  it('builds marketing start-auth waitlist links', () => {
    expect(buildWaitlistStartAuthPath()).toBe('/waitlist?start=1')
    expect(buildWaitlistStartAuthUrl('https://4626.fun/')).toBe('https://4626.fun/waitlist?start=1')
    expect(isWaitlistStartAuthSearchParam('1')).toBe(true)
    expect(isWaitlistStartAuthSearchParam('true')).toBe(true)
    expect(isWaitlistStartAuthSearchParam('0')).toBe(false)
    expect(isWaitlistStartAuthSearchParam(null)).toBe(false)
  })

  it('builds waitlist entry URLs against the provided base origin', () => {
    expect(buildWaitlistEntryUrl('https://4626.fun')).toBe('https://4626.fun/waitlist')
    expect(buildWaitlistEntryUrl('https://app.4626.fun/')).toBe('https://app.4626.fun/waitlist')
  })

  it('round-trips a validated AlfaClub room continuation', () => {
    const url = buildWaitlistEntryUrl('https://4626.fun', {
      alfaClubReturnPath: '/rooms?roomId=1659&tab=liquidity&pool=0x1000000000000000000000000000000000000000',
    })
    const parsed = new URL(url)

    expect(parsed.origin).toBe('https://4626.fun')
    expect(parsed.pathname).toBe('/waitlist')
    expect(readWaitlistAlfaClubReturnPath(parsed.search)).toBe(
      '/rooms?roomId=1659&tab=liquidity&pool=0x1000000000000000000000000000000000000000',
    )
  })

  it('rejects arbitrary AlfaClub continuation paths and handoff injection', () => {
    expect(normalizeAlfaClubWaitlistReturnPath('https://evil.example/rooms')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('//evil.example/rooms')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('/admin')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('/rooms?roomId=not-a-room')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('/rooms?tab=admin')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('/rooms?cv_handoff=attacker')).toBeNull()
    expect(normalizeAlfaClubWaitlistReturnPath('/rooms?redirect=https://evil.example')).toBeNull()
    expect(
      buildWaitlistEntryUrl('https://4626.fun', {
        alfaClubReturnPath: 'https://evil.example/rooms',
      }),
    ).toBe('https://4626.fun/waitlist')
  })

  it('builds the canonical marketing waitlist path and URL', () => {
    expect(getCanonicalMarketingWaitlistPath()).toBe('/waitlist')
    expect(buildCanonicalMarketingWaitlistUrl('https://4626.fun/')).toBe('https://4626.fun/waitlist')
  })

  it('builds setup deep links on the marketing waitlist host', () => {
    vi.spyOn(host, 'getMarketingBaseUrl').mockReturnValue('http://localhost:3000')

    expect(buildWaitlistSetupUrl('base-app')).toBe('http://localhost:3000/waitlist?setup=base-app')
    expect(buildWaitlistSetupUrl('owner-install')).toBe('http://localhost:3000/waitlist?setup=owner-install')
    expect(buildWaitlistSetupPath('owner-install')).toBe('/waitlist?setup=owner-install')
  })

  it('builds setup deep links on 4626.fun even when the caller is on app.4626.fun', () => {
    const marketingBaseUrl = vi.spyOn(host, 'getMarketingBaseUrl').mockReturnValue('https://4626.fun')

    expect(buildWaitlistSetupUrl('base-app')).toBe('https://4626.fun/waitlist?setup=base-app')

    marketingBaseUrl.mockRestore()
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
