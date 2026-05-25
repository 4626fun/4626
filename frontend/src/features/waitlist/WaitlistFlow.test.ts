import { describe, expect, it } from 'vitest'

import {
  isWaitlistStepTwoSigningComplete,
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldShowParentCswAddOwnerPanel,
} from './waitlistFlowState'
import { isPrivyLoginBootstrapError } from './WaitlistFlow'

describe('resolveWaitlistStep', () => {
  it('keeps unverified accounts on auth', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: false,
        },
      }),
    ).toBe('auth')
  })

  it('routes verified-email accounts to the setup workspace', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
        },
      }),
    ).toBe('done')
  })
})

describe('shouldAutoBootstrapWaitlistSession', () => {
  it('bootstraps whenever an auth-step Privy session exists', () => {
    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
        recoveryRequired: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'auth',
        privyAuthed: true,
        recoveryRequired: true,
      }),
    ).toBe(false)

    expect(
      shouldAutoBootstrapWaitlistSession({
        step: 'done',
        privyAuthed: true,
        recoveryRequired: false,
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

describe('isWaitlistStepTwoSigningComplete', () => {
  it('completes only when embedded EOA is on-chain parent CSW owner', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: true,
        accountSignals: {
          executionTrack: 'none-yet',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe(true)
  })

  it('does not complete from server owner flag without on-chain confirmation', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: true,
        accountSignals: {
          executionTrack: 'none-yet',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })
})

describe('shouldShowParentCswAddOwnerPanel', () => {
  it('shows the Zora EOA-owner panel when signing is incomplete and EOA owners exist', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        zoraLinked: true,
        ownerInstallRequested: false,
        signingStepComplete: false,
        executionTrack: 'none-yet',
        accountSignals: {
          executionTrack: 'none-yet',
          canonicalCswAddress: '0x1234567890123456789012345678901234567890',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
        },
        parentEmbeddedOwnerOnChain: false,
        onchainEoaOwnerCount: 1,
      }),
    ).toBe(true)
  })

  it('hides the panel for passkey-only Zora CSWs without EOA owners', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        zoraLinked: true,
        ownerInstallRequested: false,
        signingStepComplete: false,
        executionTrack: 'none-yet',
        accountSignals: {
          executionTrack: 'none-yet',
          canonicalCswAddress: '0x1234567890123456789012345678901234567890',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
        },
        parentEmbeddedOwnerOnChain: false,
        onchainEoaOwnerCount: 0,
      }),
    ).toBe(false)
  })

  it('hides the panel when signing is already complete on-chain', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        zoraLinked: true,
        ownerInstallRequested: true,
        signingStepComplete: true,
        executionTrack: 'legacy-owner-install',
        accountSignals: {
          executionTrack: 'legacy-owner-install',
          canonicalCswAddress: '0x1234567890123456789012345678901234567890',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: true,
        onchainEoaOwnerCount: 1,
      }),
    ).toBe(false)
  })

  it('allows owner-install resume without Zora link when EOA owners exist', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        zoraLinked: false,
        ownerInstallRequested: true,
        signingStepComplete: false,
        executionTrack: 'none-yet',
        accountSignals: {
          executionTrack: 'none-yet',
          canonicalCswAddress: '0x1234567890123456789012345678901234567890',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
        },
        parentEmbeddedOwnerOnChain: false,
        onchainEoaOwnerCount: 1,
      }),
    ).toBe(true)
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
