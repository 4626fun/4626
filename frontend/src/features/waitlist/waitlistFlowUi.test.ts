import { describe, expect, it } from 'vitest'

import {
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
} from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy that supports both existing and new accounts', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Start with email',
      subtitle: 'Use one secure sign-in to save your spot. We guide the rest step by step.',
      ctaLabel: 'Continue',
      busyLabel: 'Preparing your account…',
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
      title: 'You are approved',
      subtitle: 'Your setup is complete and access is live. Enter the app now, or open Accounts for advanced controls.',
      primaryLabel: '■ Enter App',
      secondaryLabel: 'Open Accounts',
    })
  })

  it('points unaccepted users toward accounts while they wait for approval', () => {
    expect(deriveWaitlistDoneUi(false)).toEqual({
      title: 'Setup complete',
      subtitle: 'Your account is ready. App access is still pending. Open Accounts for advanced controls while approval catches up.',
      primaryLabel: '■ Open Accounts',
      secondaryLabel: null,
    })
  })
})
