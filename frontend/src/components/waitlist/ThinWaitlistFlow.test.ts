import { describe, expect, it } from 'vitest'

import { resolveWaitlistStep, shouldAutoBootstrapWaitlistSession, shouldAutoStartWaitlistAuth } from './ThinWaitlistFlow'

describe('resolveWaitlistStep', () => {
  it('keeps unverified accounts on auth', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: false,
          appAccessStatus: null,
          accountSignals: {
            linked: false,
            canonicalCswAddress: null,
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: null,
      }),
    ).toBe('auth')
  })

  it('routes verified-email accounts without a canonical csw into wallet setup', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            linked: false,
            canonicalCswAddress: null,
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: null,
      }),
    ).toBe('wallet')
  })

  it('keeps canonical-wallet accounts in wallet setup until owner delegation is verified', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            linked: true,
            canonicalCswAddress: '0x123',
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: false,
      }),
    ).toBe('wallet')
  })

  it('routes approved, fully linked accounts into done state', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: {
            linked: true,
            canonicalCswAddress: '0x123',
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: true,
      }),
    ).toBe('done')
  })

  it('keeps approved accounts in wallet until csw readiness is complete', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: {
            linked: true,
            canonicalCswAddress: null,
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: null,
      }),
    ).toBe('wallet')

    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: {
            linked: true,
            canonicalCswAddress: '0x123',
            creatorCoin: null,
            zoraHandle: null,
            lastResolvedAt: null,
          },
        },
        ownerDelegationVerified: false,
      }),
    ).toBe('wallet')
  })
})

describe('shouldAutoStartWaitlistAuth', () => {
  it('does not auto-start auth for modal entry unless explicit auth intent was requested', () => {
    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(false)
  })

  it('does not auto-start auth for recovery, errors, or missing explicit intent', () => {
    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'embedded',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: true,
        error: null,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: 'Failed to start sign-in.',
      }),
    ).toBe(false)
  })

  it('does not auto-start auth when Privy is not ready or the user is already signed in', () => {
    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'loading',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: false,
        step: 'auth',
        privyAuthed: true,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(false)
  })

  it('auto-starts auth for the dedicated page when the entry explicitly requested it', () => {
    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'page',
        autoStartRequested: true,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(true)

    expect(
      shouldAutoStartWaitlistAuth({
        variant: 'modal',
        autoStartRequested: true,
        step: 'auth',
        privyAuthed: false,
        privyClientStatus: 'ready',
        recoveryRequired: false,
        error: null,
      }),
    ).toBe(true)
  })
})

describe('shouldAutoBootstrapWaitlistSession', () => {
  it('only bootstraps restored Privy auth after an explicit auth flow has started', () => {
    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
        authFlowStarted: true,
      }),
    ).toBe(true)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
        authFlowStarted: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'wallet',
        privyAuthed: true,
        authFlowStarted: true,
      }),
    ).toBe(false)
  })
})
