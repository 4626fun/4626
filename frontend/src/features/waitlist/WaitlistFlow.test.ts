import { describe, expect, it } from 'vitest'

import {
  applyWaitlistSubAccountConnectOverlay,
  isWaitlistSigningReady,
  mergeCanonicalWaitlistAccount,
  resolveWaitlistStep,
  shouldAutoBootstrapWaitlistSession,
  shouldForceBaseAppConnectStep,
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

  it('keeps verified-email accounts on auth until signing is ready when sub-account flow is off', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
        subAccountFlowEnabled: false,
      }),
    ).toBe('auth')
  })

  it('routes verified Base App users to connect-base-app before legacy owner install when flag is on', () => {
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
    ).toBe('connect-base-app')
  })

  it('keeps verified-but-unapproved accounts on auth when signer install is incomplete and sub-account flow is off', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: null,
        },
        subAccountFlowEnabled: false,
      }),
    ).toBe('auth')
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

  it('keeps approved accounts on auth when signer install is not complete', () => {
    expect(
      resolveWaitlistStep({
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
        },
      }),
    ).toBe('auth')

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
    ).toBe('auth')
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

  it('forces connect-base-app when setup=base-app deep link is present and signing is incomplete', () => {
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
    ).toBe(true)
  })

  it('does not force connect-base-app when setup=base-app but signing is already ready', () => {
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
      }),
    ).toBe(false)
  })

  it('treats registered baseSubAccount as signing-ready even when executionTrack lags', () => {
    expect(
      isWaitlistSigningReady({
        accountSignals: {
          executionTrack: 'none-yet',
          baseSubAccount: { address: '0xabc', registered: true, isDistinctFromCsw: true },
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
    expect(isWaitlistSigningReady(merged)).toBe(true)
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
