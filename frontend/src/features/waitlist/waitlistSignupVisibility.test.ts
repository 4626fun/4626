import { describe, expect, it } from 'vitest'

import { shouldShowWaitlistEmailSignup } from './waitlistSignupVisibility'

describe('shouldShowWaitlistEmailSignup', () => {
  it('shows email signup for signed-out visitors', () => {
    expect(
      shouldShowWaitlistEmailSignup({
        joinedSessionAddress: null,
        walletSignInPending: false,
        walletSessionAddress: null,
      }),
    ).toBe(true)
  })

  it('hides email signup while returning wallet sign-in is active', () => {
    expect(
      shouldShowWaitlistEmailSignup({
        joinedSessionAddress: null,
        walletSignInPending: true,
        walletSessionAddress: null,
      }),
    ).toBe(false)
  })

  it('hides email signup after wallet sign-in succeeds', () => {
    expect(
      shouldShowWaitlistEmailSignup({
        joinedSessionAddress: null,
        walletSignInPending: false,
        walletSessionAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      }),
    ).toBe(false)
  })

  it('hides email signup when the waitlist session is already joined', () => {
    expect(
      shouldShowWaitlistEmailSignup({
        joinedSessionAddress: '0xabc1230000000000000000000000000000000000',
        walletSignInPending: false,
        walletSessionAddress: null,
      }),
    ).toBe(false)
  })
})
