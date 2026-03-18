import { describe, expect, it } from 'vitest'

import {
  WAITLIST_PRIVY_LOGIN_METHODS,
  WAITLIST_RECOVERY_LOGIN_METHODS,
  buildWaitlistPrivyLoginOptions,
  buildWaitlistRecoveryLoginOptions,
} from './waitlistLoginOptions'

describe('waitlist Privy login options', () => {
  it('prefers email and social methods before wallet for waitlist auth', () => {
    expect(WAITLIST_PRIVY_LOGIN_METHODS).toEqual(['email', 'google', 'twitter', 'wallet'])
  })

  it('builds login options with the waitlist-specific method order', () => {
    expect(buildWaitlistPrivyLoginOptions()).toEqual({
      loginMethods: ['email', 'google', 'twitter', 'wallet'],
    })
  })

  it('uses non-wallet methods for recovery retries', () => {
    expect(WAITLIST_RECOVERY_LOGIN_METHODS).toEqual(['email', 'google', 'twitter'])
    expect(buildWaitlistRecoveryLoginOptions()).toEqual({
      loginMethods: ['email', 'google', 'twitter'],
    })
  })
})
