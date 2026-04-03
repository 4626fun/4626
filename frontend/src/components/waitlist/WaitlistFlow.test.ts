import { describe, expect, it } from 'vitest'

import {
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldAutoHandoffApprovedAccount,
  shouldAutoStartWaitlistAuth,
} from './waitlistFlowState'

describe('resolveWaitlistStep', () => {
  it('keeps unverified accounts on auth', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: false,
          appAccessStatus: null,
        },
      }),
    ).toBe('auth')
  })

  it('routes verified-email accounts without a canonical csw into wallet setup', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
      }),
    ).toBe('wallet')
  })

  it('keeps verified-but-unapproved accounts in wallet setup', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
      }),
    ).toBe('wallet')
  })

  it('routes approved, fully linked accounts into done state', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
        },
      }),
    ).toBe('done')
  })

  it('routes approved accounts into done regardless of wallet-readiness details', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
        },
      }),
    ).toBe('done')

    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
        },
      }),
    ).toBe('done')
  })
})

describe('shouldAutoStartWaitlistAuth', () => {
  it('does not auto-start auth for modal entry unless explicit auth intent was requested', () => {
    expect(
      shouldAutoStartWaitlistAuth({
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
  it('bootstraps whenever an auth-step Privy session exists', () => {
    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
      }),
    ).toBe(true)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
      }),
    ).toBe(true)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'wallet',
        privyAuthed: true,
      }),
    ).toBe(false)
  })
})

describe('mergeCanonicalWaitlistAccount', () => {
  const account = {
    emailVerified: true,
    appAccessStatus: null,
    accountSignals: {
      linked: false,
      canonicalCswAddress: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: null,
    },
  }

  it('reuses the canonical wallet resolved during bootstrap when the summary payload is still missing it', () => {
    const merged = mergeCanonicalWaitlistAccount(account, {
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
    })

    expect(merged.accountSignals.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
    expect(account.accountSignals.canonicalCswAddress).toBeNull()
  })

  it('prefers the canonical wallet resolved during bootstrap over a stale summary value', () => {
    const merged = mergeCanonicalWaitlistAccount(
      {
        ...account,
        accountSignals: {
          ...account.accountSignals,
          canonicalCswAddress: '0x2222222222222222222222222222222222222222',
        },
      },
      {
        canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      },
    )

    expect(merged.accountSignals.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
  })
})

describe('shouldAutoHandoffApprovedAccount', () => {
  it('auto-handoffs approved done-state accounts only on embedded waitlist surfaces', () => {
    expect(
      shouldAutoHandoffApprovedAccount({
        variant: 'embedded',
        step: 'done',
        canEnterApp: true,
        enterAppBusy: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoHandoffApprovedAccount({
        variant: 'page',
        step: 'done',
        canEnterApp: true,
        enterAppBusy: false,
      }),
    ).toBe(false)
  })

  it('does not auto-handoff while not done, not approved, or already entering', () => {
    expect(
      shouldAutoHandoffApprovedAccount({
        variant: 'embedded',
        step: 'wallet',
        canEnterApp: true,
        enterAppBusy: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoHandoffApprovedAccount({
        variant: 'embedded',
        step: 'done',
        canEnterApp: false,
        enterAppBusy: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoHandoffApprovedAccount({
        variant: 'embedded',
        step: 'done',
        canEnterApp: true,
        enterAppBusy: true,
      }),
    ).toBe(false)
  })
})
