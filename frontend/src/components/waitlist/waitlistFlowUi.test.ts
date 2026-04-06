import { describe, expect, it } from 'vitest'

import {
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
} from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy that supports both existing and new accounts', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Get early access',
      subtitle: 'Use one quick sign-in to save your spot. We handle account setup in the background.',
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

describe('deriveWaitlistDoneUi', () => {
  it('points accepted users toward app entry first', () => {
    expect(deriveWaitlistDoneUi(true)).toEqual({
      title: "You're in!",
      subtitle: 'Your account is ready. Enter the app now, or visit accounts to manage connected identities and points.',
      primaryLabel: '■ Enter App',
      secondaryLabel: 'Go to accounts',
    })
  })

  it('points unaccepted users toward accounts while they wait for approval', () => {
    expect(deriveWaitlistDoneUi(false)).toEqual({
      title: "You're in!",
      subtitle: 'Your waitlist account is set. Visit accounts to manage identities and points while approval is pending.',
      primaryLabel: '■ Go to accounts',
      secondaryLabel: null,
    })
  })
})
