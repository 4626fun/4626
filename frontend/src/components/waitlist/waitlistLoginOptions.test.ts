import { describe, expect, it } from 'vitest'

import {
  WAITLIST_BASE_LOGIN_METHODS,
  WAITLIST_EMAIL_LOGIN_METHODS,
  WAITLIST_RECOVERY_LOGIN_METHODS,
  buildWaitlistBaseLoginOptions,
  buildWaitlistEmailLoginOptions,
  buildWaitlistRecoveryLoginOptions,
} from './waitlistLoginOptions'

describe('waitlist Privy login options', () => {
  it('uses email-only login for canonical account creation', () => {
    expect(WAITLIST_EMAIL_LOGIN_METHODS).toEqual(['email'])
    expect(buildWaitlistEmailLoginOptions()).toEqual({
      loginMethods: ['email'],
    })
  })

  it('keeps a dedicated wallet-native Base option', () => {
    expect(WAITLIST_BASE_LOGIN_METHODS).toEqual(['wallet'])
    expect(buildWaitlistBaseLoginOptions()).toEqual({
      loginMethods: ['wallet'],
    })
  })

  it('uses verified email for recovery retries', () => {
    expect(WAITLIST_RECOVERY_LOGIN_METHODS).toEqual(['email'])
    expect(buildWaitlistRecoveryLoginOptions()).toEqual({
      loginMethods: ['email'],
    })
  })
})
