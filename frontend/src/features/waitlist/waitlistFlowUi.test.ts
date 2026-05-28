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
