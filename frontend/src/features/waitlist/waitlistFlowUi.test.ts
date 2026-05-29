import { describe, expect, it } from 'vitest'

import { canEnterAppFromAccountState, deriveWaitlistAuthUi } from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy that supports both existing and new accounts', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Waitlist',
      subtitle: 'Sign in with email to save your spot.',
      ctaLabel: 'Continue',
      busyLabel: 'Setting up your account…',
    })
  })

  it('switches to existing-account recovery copy when recovery is required', () => {
    expect(deriveWaitlistAuthUi({ recoveryRequired: true })).toEqual({
      title: 'Welcome back',
      subtitle: 'This email already has a 4626 account. Sign in to join the waitlist with it.',
      ctaLabel: 'Use existing account',
      busyLabel: 'Signing in…',
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
