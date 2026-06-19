import { describe, expect, it } from 'vitest'

import {
  buildWaitlistEmailLoginOptions,
  buildWaitlistRecoveryLoginOptions,
  shouldPreferWaitlistWalletLogin,
} from './waitlistLoginOptions'

describe('waitlist Privy login options', () => {
  it('uses email-only login for canonical account creation', () => {
    expect(buildWaitlistEmailLoginOptions()).toEqual({
      loginMethods: ['email'],
    })
  })

  it('prefers wallet-first login for returning users with a verified email hint', () => {
    expect(
      buildWaitlistEmailLoginOptions({
        verifiedEmailHint: 'returning@example.com',
      }),
    ).toEqual({
      loginMethods: ['wallet', 'email'],
    })
  })

  it('prefers wallet-first login when a prior-auth marker exists', () => {
    expect(
      buildWaitlistEmailLoginOptions({
        hasPriorAuthMarker: true,
      }),
    ).toEqual({
      loginMethods: ['wallet', 'email'],
    })
  })

  it('uses verified email with signup disabled for recovery retries', () => {
    expect(buildWaitlistRecoveryLoginOptions()).toEqual({
      loginMethods: ['email'],
      disableSignup: true,
    })
  })
})

describe('shouldPreferWaitlistWalletLogin', () => {
  it('returns true when a verified-email hint exists', () => {
    expect(shouldPreferWaitlistWalletLogin({ verifiedEmailHint: 'member@4626.fun' })).toBe(true)
  })

  it('returns false for empty hints', () => {
    expect(shouldPreferWaitlistWalletLogin({ verifiedEmailHint: '' })).toBe(false)
    expect(shouldPreferWaitlistWalletLogin({ verifiedEmailHint: null })).toBe(false)
    expect(shouldPreferWaitlistWalletLogin()).toBe(false)
  })

  it('returns true when a prior-auth marker is present without an email hint', () => {
    expect(
      shouldPreferWaitlistWalletLogin({
        verifiedEmailHint: null,
        hasPriorAuthMarker: true,
      }),
    ).toBe(true)
  })
})
