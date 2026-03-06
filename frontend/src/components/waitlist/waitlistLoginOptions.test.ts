import { describe, expect, it } from 'vitest'

import { WAITLIST_PRIVY_LOGIN_METHODS, buildWaitlistPrivyLoginOptions } from './waitlistLoginOptions'

describe('waitlist Privy login options', () => {
  it('prefers email and social methods before wallet for waitlist auth', () => {
    expect(WAITLIST_PRIVY_LOGIN_METHODS).toEqual(['email', 'google', 'twitter', 'farcaster', 'wallet'])
  })

  it('builds login options with the waitlist-specific method order', () => {
    expect(buildWaitlistPrivyLoginOptions()).toEqual({
      loginMethods: ['email', 'google', 'twitter', 'farcaster', 'wallet'],
    })
  })
})
