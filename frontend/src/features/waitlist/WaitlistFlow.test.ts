import { describe, expect, it } from 'vitest'

import {
  applyWaitlistSubAccountConnectOverlay,
  isWaitlistSubAccountLinkReady,
  isWaitlistStepTwoSigningComplete,
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldForceBaseAppConnectStep,
  shouldForceOwnerInstallSetupStep,
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

  it('keeps verified-email accounts on the setup workspace until signing is ready when sub-account flow is off', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
        subAccountFlowEnabled: false,
      }),
    ).toBe('done')
  })

  it('routes verified Base App users to the setup workspace (parent CSW owner install) when flag is on', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            executionTrack: 'none-yet',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: false,
      }),
    ).toBe('done')
  })

  it('keeps verified-but-unapproved accounts on the setup workspace when signer install is incomplete and sub-account flow is off', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
        subAccountFlowEnabled: false,
      }),
    ).toBe('done')
  })

  it('routes approved accounts into done once embedded owner install is complete', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
      }),
    ).toBe('done')
  })

  it('keeps approved accounts on the setup workspace when signer install is not complete', () => {
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
          accountSignals: {
            executionTrack: 'none-yet',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
      }),
    ).toBe('done')
  })

  it('routes verified accounts into done when owner install is true even without executionTrack', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
      }),
    ).toBe('done')
  })

  it('parent CSW execution — stays on done when a sub-account address exists but parent signing is incomplete', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          baseSubAccount: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          accountSignals: {
            canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            executionTrack: 'none-yet',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
            baseSubAccount: {
              address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              registered: false,
              isDistinctFromCsw: true,
            },
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: false,
      }),
    ).toBe('done')
  })

  it('Track C2 — routes to done when sub-account execution track is already registered', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            executionTrack: 'sub-account',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: false,
      }),
    ).toBe('done')
  })

  it('Track C2 — does not route to connect-base-app when flag is off', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
        subAccountFlowEnabled: false,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: false,
      }),
    ).toBe('done')
  })

  it('Track C2 — does not route to connect-base-app when embedded EOA is missing', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: false,
        subAccountStepCompleted: false,
      }),
    ).toBe('done')
  })

  it('Track C2 — once the connect-base-app step is completed, falls through to done', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: true,
      }),
    ).toBe('done')
  })

  it('Track C2 — session-local connect-base-app completion stays on done before bootstrap reflects executionTrack', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          accountSignals: {
            canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            executionTrack: 'none-yet',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        subAccountStepCompleted: true,
      }),
    ).toBe('done')
  })

  it('does not force connect-base-app (parent CSW execution only)', () => {
    expect(
      shouldForceBaseAppConnectStep({
        setupIntent: 'base-app',
        subAccountFlowEnabled: true,
        account: {
          emailVerified: true,
          accountSignals: {
            canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            executionTrack: 'none-yet',
          },
        },
      }),
    ).toBe(false)
  })

  it('does not force connect-base-app when setup=base-app and on-chain signing is complete', () => {
    expect(
      shouldForceBaseAppConnectStep({
        setupIntent: 'base-app',
        subAccountFlowEnabled: true,
        account: {
          emailVerified: true,
          accountSignals: {
            executionTrack: 'sub-account',
            baseSubAccount: {
              address: '0xabc0000000000000000000000000000000000001',
              registered: true,
              isDistinctFromCsw: true,
            },
          },
        },
        signingStepComplete: true,
      }),
    ).toBe(false)
  })

  it('does not force connect-base-app when setup=base-app and signing is incomplete', () => {
    expect(
      shouldForceBaseAppConnectStep({
        setupIntent: 'base-app',
        subAccountFlowEnabled: true,
        account: {
          emailVerified: true,
          accountSignals: {
            executionTrack: 'sub-account',
            baseSubAccount: {
              address: '0xabc0000000000000000000000000000000000001',
              registered: true,
              isDistinctFromCsw: true,
            },
          },
        },
        signingStepComplete: false,
        signingProbePending: false,
      }),
    ).toBe(false)
  })

  it('does not force connect-base-app while signing probe is pending', () => {
    expect(
      shouldForceBaseAppConnectStep({
        setupIntent: 'base-app',
        subAccountFlowEnabled: true,
        account: {
          emailVerified: true,
          accountSignals: {
            executionTrack: 'sub-account',
            baseSubAccount: {
              address: '0xabc0000000000000000000000000000000000001',
              registered: true,
              isDistinctFromCsw: true,
            },
          },
        },
        signingStepComplete: false,
        signingProbePending: true,
      }),
    ).toBe(false)
  })

  it('forces done workspace when setup=owner-install deep link is present', () => {
    expect(
      shouldForceOwnerInstallSetupStep({
        setupIntent: 'owner-install',
        subAccountFlowEnabled: true,
        account: { emailVerified: true },
      }),
    ).toBe(true)
  })

  it('routes to done instead of connect-base-app when setup=owner-install is present', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
          baseSubAccount: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          accountSignals: {
            canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            executionTrack: 'none-yet',
            baseSubAccount: {
              address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              registered: false,
              isDistinctFromCsw: true,
            },
          },
        },
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
        setupIntent: 'owner-install',
      }),
    ).toBe('done')
  })

  it('treats parent embedded owner as link-ready, not sub-account registration alone', () => {
    expect(
      isWaitlistSubAccountLinkReady({
        accountSignals: {
          executionTrack: 'none-yet',
          baseSubAccount: { address: '0xabc', registered: true, isDistinctFromCsw: true },
        },
      }),
    ).toBe(false)

    expect(
      isWaitlistSubAccountLinkReady({
        accountSignals: {
          executionTrack: 'legacy-owner-install',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
      }),
    ).toBe(true)
  })

  it('applyWaitlistSubAccountConnectOverlay upgrades none-yet accounts after connect', () => {
    const merged = applyWaitlistSubAccountConnectOverlay(
      {
        emailVerified: true,
        appAccessStatus: null,
        baseSubAccount: null,
        accountSignals: {
          linked: true,
          canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
          executionTrack: 'none-yet',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
        },
      },
      {
        parentAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
        subAccountAddress: '0x00000000000000000000000000000000000000dd',
      },
      true,
    )
    expect(merged.accountSignals.executionTrack).toBe('sub-account')
    expect(merged.baseSubAccount).toBe('0x00000000000000000000000000000000000000dd')
    expect(isWaitlistSubAccountLinkReady(merged)).toBe(false)
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
        step: 'auth',
        privyAuthed: true,
        recoveryRequired: false,
      }),
    ).toBe(true)

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
  const subAccountReadySignals = {
    canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
    executionTrack: 'sub-account' as const,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
    baseSubAccount: { address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', registered: true },
  }

  it('does not complete desktop owner-install from sub-account registration alone', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: true,
        accountSignals: subAccountReadySignals,
      }),
    ).toBe(false)
  })

  it('completes desktop owner-install only when embedded EOA is on-chain parent CSW owner', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: true,
        accountSignals: {
          ...subAccountReadySignals,
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe(true)
  })

  it('does not complete desktop owner-install from server owner flag without on-chain confirmation', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: true,
        accountSignals: {
          ...subAccountReadySignals,
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })

  it('does not complete Base App path from registered sub-account without on-chain owner', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: subAccountReadySignals,
        subAccountEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })

  it('does not complete signing from sub-account on-chain owner without parent CSW owner', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: subAccountReadySignals,
        subAccountEmbeddedOwnerOnChain: true,
      }),
    ).toBe(false)
  })

  it('completes signing when embedded EOA is on-chain owner of the parent CSW', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: subAccountReadySignals,
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe(true)
  })

  it('does not complete none-yet parent signing from a stale success notice or server flag alone', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: {
          canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
          executionTrack: 'none-yet',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })
})

describe('shouldShowParentCswAddOwnerPanel', () => {
  it('shows parent add-owner until parent embedded owner is confirmed on-chain', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        ownerInstallRequested: true,
        signingStepComplete: false,
        executionTrack: 'none-yet',
        preferBaseAppSubAccountSetup: false,
        accountSignals: {
          executionTrack: 'none-yet',
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
        },
        parentEmbeddedOwnerOnChain: false,
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
