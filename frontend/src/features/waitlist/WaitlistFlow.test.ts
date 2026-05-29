import { describe, expect, it } from 'vitest'

import {
  isWaitlistStepTwoSigningComplete,
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  resolveWaitlistAccordionOpenStep,
  shouldFocusWaitlistBaseAppConnect,
  shouldForceBaseAppConnectStep,
  shouldShowBaseAppConnectPanel,
  shouldShowParentCswAddOwnerPanel,
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
        },
      }),
    ).toBe('done')
  })
})

describe('resolveWaitlistAccordionOpenStep', () => {
  it('opens step 2 for Base App connect focus even before step 1 completes', () => {
    expect(
      resolveWaitlistAccordionOpenStep({
        manualOpenStep: null,
        ownerInstallRequested: false,
        stepOneComplete: false,
        focusBaseAppConnect: true,
      }),
    ).toBe(2)
  })

  it('respects manual step selection', () => {
    expect(
      resolveWaitlistAccordionOpenStep({
        manualOpenStep: 1,
        ownerInstallRequested: false,
        stepOneComplete: true,
        focusBaseAppConnect: true,
      }),
    ).toBe(1)
  })

  it('prefers Base App connect focus over owner-install deep links', () => {
    expect(
      resolveWaitlistAccordionOpenStep({
        manualOpenStep: null,
        ownerInstallRequested: true,
        stepOneComplete: false,
        focusBaseAppConnect: true,
      }),
    ).toBe(2)
  })
})

describe('shouldFocusWaitlistBaseAppConnect', () => {
  const account = {
    emailVerified: true,
    accountSignals: {
      executionTrack: 'none-yet' as const,
      canonicalCswAddress: '0x1234567890123456789012345678901234567890',
    },
  }

  it('focuses Base App connect in-app when the panel is ready', () => {
    expect(
      shouldFocusWaitlistBaseAppConnect({
        inBaseApp: true,
        showBaseAppConnectPanel: true,
        signingStepComplete: false,
        setupIntent: null,
        subAccountFlowEnabled: true,
        account,
      }),
    ).toBe(true)
  })

  it('does not focus after signing is complete', () => {
    expect(
      shouldFocusWaitlistBaseAppConnect({
        inBaseApp: true,
        showBaseAppConnectPanel: true,
        signingStepComplete: true,
        setupIntent: null,
        subAccountFlowEnabled: true,
        account,
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
