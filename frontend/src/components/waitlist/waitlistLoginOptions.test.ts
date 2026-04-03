import { describe, expect, it } from 'vitest'

import { buildWaitlistEmailLoginOptions, buildWaitlistRecoveryLoginOptions } from './waitlistLoginOptions'

describe('waitlist Privy login options', () => {
  it('uses email-only login for canonical account creation', () => {
    expect(buildWaitlistEmailLoginOptions()).toEqual({
      loginMethods: ['email'],
    })
  })

  it('uses verified email with signup disabled for recovery retries', () => {
    expect(buildWaitlistRecoveryLoginOptions()).toEqual({
      loginMethods: ['email'],
      disableSignup: true,
    })
  })
})
