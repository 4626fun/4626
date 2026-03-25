import { describe, expect, it } from 'vitest'

import {
  canEnterAppFromAccountState,
  deriveWaitlistAuthUi,
  deriveWaitlistDoneUi,
  deriveWaitlistZoraUi,
  hasZoraProfileSignals,
} from './waitlistFlowUi'

describe('deriveWaitlistAuthUi', () => {
  it('uses sign-in copy and black-square glyph (email only in Privy)', () => {
    expect(deriveWaitlistAuthUi()).toEqual({
      title: 'Get early access',
      subtitle:
        'Sign in with your email (one-time code). After verification, track your points, climb the leaderboard, and keep building your account while approval is pending.',
      ctaLabel: '■ Continue with email',
      busyLabel: 'Opening email sign-in…',
    })
  })
})

describe('hasZoraProfileSignals', () => {
  it('is false for null or empty placeholders', () => {
    expect(hasZoraProfileSignals(null)).toBe(false)
    expect(
      hasZoraProfileSignals({
        zoraHandle: null,
        canonicalCswAddress: null,
        creatorCoin: null,
      }),
    ).toBe(false)
  })

  it('is true when any display field is present', () => {
    expect(hasZoraProfileSignals({ zoraHandle: 'alice', canonicalCswAddress: null, creatorCoin: null })).toBe(true)
    expect(
      hasZoraProfileSignals({
        zoraHandle: null,
        canonicalCswAddress: '0x0000000000000000000000000000000000000001',
        creatorCoin: null,
      }),
    ).toBe(true)
    expect(
      hasZoraProfileSignals({
        zoraHandle: null,
        canonicalCswAddress: null,
        creatorCoin: { address: '0x0000000000000000000000000000000000000002' },
      }),
    ).toBe(true)
  })
})

describe('deriveWaitlistZoraUi', () => {
  it('defaults to connect and skip actions before Zora is linked', () => {
    expect(deriveWaitlistZoraUi(false)).toEqual({
      subtitle: 'Link the wallet you use on Zora to import your profile and creator coin.',
      primaryAction: 'connect',
      primaryLabel: '■ Link Zora wallet',
      secondaryAction: 'skip',
      secondaryLabel: 'Continue without Zora',
      connectedLabel: 'Zora profile found',
      resolvingLabel: 'Resolving your Zora details…',
    })
  })

  it('switches to continue and reconnect actions after Zora is linked', () => {
    expect(deriveWaitlistZoraUi(true)).toEqual({
      subtitle: 'We found your Zora profile from a linked wallet.',
      primaryAction: 'finish',
      primaryLabel: 'Continue',
      secondaryAction: 'reconnect',
      secondaryLabel: 'Link a different wallet',
      connectedLabel: 'Zora profile found',
      resolvingLabel: 'Resolving your Zora details…',
    })
  })
})

describe('canEnterAppFromAccountState', () => {
  it('allows app entry when app access is approved even without points tier', () => {
    expect(canEnterAppFromAccountState({ appAccessStatus: 'approved', tier: 0 })).toBe(true)
  })

  it('keeps app entry blocked until admin approval exists', () => {
    expect(canEnterAppFromAccountState({ appAccessStatus: null, tier: 0 })).toBe(false)
    expect(canEnterAppFromAccountState({ appAccessStatus: null, tier: 1 })).toBe(false)
    expect(canEnterAppFromAccountState({ appAccessStatus: 'pending', tier: 10 })).toBe(false)
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
