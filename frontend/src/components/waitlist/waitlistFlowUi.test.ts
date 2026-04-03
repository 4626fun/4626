import { describe, expect, it } from 'vitest'

import {
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
} from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy and black-square glyph (email only in Privy)', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Get early access',
      subtitle: 'Verify your email to lock your spot and unlock your referral link.',
      ctaLabel: 'Join waitlist',
      busyLabel: 'Opening email sign-in…',
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
      subtitle: 'Visit accounts to manage connected identities, earn points, and wait for admin approval.',
      primaryLabel: '■ Go to accounts',
      secondaryLabel: null,
    })
  })
})
