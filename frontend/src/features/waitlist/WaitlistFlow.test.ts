import { describe, expect, it } from 'vitest'

import {
  isWaitlistStepTwoSigningComplete,
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldForceBaseAppConnectStep,
  shouldShowBaseAppConnectPanel,
  shouldShowParentCswAddOwnerPanel,
  applyWaitlistSubAccountConnectOverlay,
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

  it('routes verified-email accounts to the setup workspace', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
      }),
    ).toBe('done')
  })

  it('routes Base App users to connect-base-app when sub-account flow is enabled', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            executionTrack: 'none-yet',
            canonicalCswAddress: '0x1234567890123456789012345678901234567890',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
      }),
    ).toBe('connect-base-app')
  })

  it('skips connect-base-app when sub-account execution is already registered', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            executionTrack: 'sub-account',
            canonicalCswAddress: '0x1234567890123456789012345678901234567890',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
      }),
    ).toBe('done')
  })

  it('skips connect-base-app when embedded EOA is parent CSW owner on-chain (population c)', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          baseSubAccount: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          accountSignals: {
            executionTrack: 'sub-account',
            canonicalCswAddress: '0x1234567890123456789012345678901234567890',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
            baseSubAccount: {
              address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              registered: true,
              isDistinctFromCsw: true,
            },
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe('done')
  })

  it('skips connect-base-app for Zora-linked legacy-owner accounts', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            linked: true,
            executionTrack: 'legacy-owner-install',
            canonicalCswAddress: '0x1234567890123456789012345678901234567890',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
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

describe('shouldShowBaseAppConnectPanel', () => {
  const canonicalSignals = {
    executionTrack: 'none-yet' as const,
    canonicalCswAddress: '0x1234567890123456789012345678901234567890',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
  }

  it('shows Base App connect when sub-account flow is enabled and signing is incomplete', () => {
    expect(
      shouldShowBaseAppConnectPanel({
        subAccountFlowEnabled: true,
        signingStepComplete: false,
        embeddedEoaAvailable: true,
        accountSignals: canonicalSignals,
      }),
    ).toBe(true)
  })

  it('hides Base App connect for Zora users with an on-chain EOA owner path', () => {
    expect(
      shouldShowBaseAppConnectPanel({
        subAccountFlowEnabled: true,
        signingStepComplete: false,
        embeddedEoaAvailable: true,
        zoraLinked: true,
        onchainEoaOwnerCount: 1,
        accountSignals: canonicalSignals,
      }),
    ).toBe(false)
  })

  it('hides Base App connect when embedded EOA is parent CSW owner on-chain', () => {
    expect(
      shouldShowBaseAppConnectPanel({
        subAccountFlowEnabled: true,
        signingStepComplete: false,
        embeddedEoaAvailable: true,
        parentEmbeddedOwnerOnChain: true,
        accountSignals: {
          ...canonicalSignals,
          executionTrack: 'sub-account',
          baseSubAccount: {
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            registered: true,
            isDistinctFromCsw: true,
          },
        },
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

describe('shouldForceBaseAppConnectStep', () => {
  it('does not force base-app setup for population c accounts', () => {
    expect(
      shouldForceBaseAppConnectStep({
        setupIntent: 'base-app',
        subAccountFlowEnabled: true,
        parentEmbeddedOwnerOnChain: true,
        account: {
          emailVerified: true,
          accountSignals: {
            executionTrack: 'sub-account',
            canonicalCswAddress: '0x1234567890123456789012345678901234567890',
          },
        },
      }),
    ).toBe(false)
  })
})

describe('applyWaitlistSubAccountConnectOverlay', () => {
  it('does not downgrade legacy-owner accounts to sub-account overlay state', () => {
    const account = {
      emailVerified: true,
      appAccessStatus: null,
      accountSignals: {
        executionTrack: 'legacy-owner-install' as const,
        canonicalCswAddress: '0x1234567890123456789012345678901234567890',
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      },
    }

    const merged = applyWaitlistSubAccountConnectOverlay(
      account,
      {
        parentAddress: '0x1234567890123456789012345678901234567890',
        subAccountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      true,
    )

    expect(merged.accountSignals.executionTrack).toBe('legacy-owner-install')
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
