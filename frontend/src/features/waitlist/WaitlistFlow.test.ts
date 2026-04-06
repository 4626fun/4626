import { describe, expect, it } from 'vitest'

import {
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldAutoStartWaitlistAuth,
} from './waitlistFlowState'
import { isPrivyLoginBootstrapError } from './WaitlistFlow'

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

  it('routes verified-email accounts directly into done state', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
      }),
    ).toBe('done')
  })

  it('keeps verified-but-unapproved accounts in done state', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
      }),
    ).toBe('done')
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
        step: 'done',
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

describe('isPrivyLoginBootstrapError', () => {
  it('detects dynamic import fetch failures from extension contexts', () => {
    expect(
      isPrivyLoginBootstrapError(
        new Error('Failed to fetch dynamically imported module: chrome-extension://abc123/requestProvider.js'),
      ),
    ).toBe(true)
  })

  it('ignores unrelated failures', () => {
    expect(isPrivyLoginBootstrapError(new Error('Failed to bootstrap waitlist state.'))).toBe(false)
  })
})
