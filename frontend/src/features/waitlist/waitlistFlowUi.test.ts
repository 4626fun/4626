import { describe, expect, it } from 'vitest'

import { canEnterAppFromAccountState, deriveWaitlistAuthUi } from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy that supports both existing and new accounts', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Waitlist',
      subtitle: 'Step 1: sign in with email (Privy). Wallet setup is step 2.',
      ctaLabel: 'Continue with email',
      busyLabel: 'Finishing sign-in…',
    })
  })

  it('switches to existing-account recovery copy when recovery is required', () => {
    expect(deriveWaitlistAuthUi({ recoveryRequired: true })).toEqual({
      title: 'Welcome back',
      subtitle: 'This email already has a 4626 account. Sign in to join the waitlist with it.',
      ctaLabel: 'Use existing account',
      busyLabel: 'Signing in to your existing account…',
    })
  })
})

describe('canEnterAppFromAccountState', () => {
  it('allows app entry when app access is approved even without points tier', () => {
    expect(canEnterAppFromAccountState({ appAccessStatus: 'approved' })).toBe(true)
  })

  it('keeps app entry blocked until admin approval exists', () => {
    expect(canEnterAppFromAccountState({ appAccessStatus: null })).toBe(false)
    expect(canEnterAppFromAccountState({ appAccessStatus: 'pending' })).toBe(false)
  })
})
