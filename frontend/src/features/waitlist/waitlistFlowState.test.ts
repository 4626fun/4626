import { describe, expect, it } from 'vitest'

import {
  getWaitlistOtpSubmitHelperText,
  getWaitlistOtpSubmitLabel,
  isWaitlistMessagingSigningReady,
  isWaitlistStepTwoSigningComplete,
  resolveWaitlistConnectTrack,
  resolveWaitlistOtpInputStatus,
  resolveWaitlistOtpSubmitPhase,
  shouldAutoSubmitOtpCode,
  shouldFocusBaseAppWalletSetup,
  shouldShowBaseAppWalletLinkPanel,
  shouldShowParentCswAddOwnerPanel,
} from './waitlistFlowState'

const CSW = '0xAb6d5C10b03300326cd7fab7267ae192842967b5'
const EOA = '0x1111111111111111111111111111111111111111'

describe('shouldFocusBaseAppWalletSetup', () => {
  it('focuses wallet setup in Base App when wallet is not linked', () => {
    expect(
      shouldFocusBaseAppWalletSetup({
        inBaseApp: true,
        signingStepComplete: false,
        baseWalletReady: false,
        account: { emailVerified: true, accountSignals: { executionTrack: 'none-yet' } },
      }),
    ).toBe(true)
  })

  it('does not focus when signing is already complete', () => {
    expect(
      shouldFocusBaseAppWalletSetup({
        inBaseApp: true,
        signingStepComplete: true,
        baseWalletReady: true,
        account: { emailVerified: true },
      }),
    ).toBe(false)
  })

  it('does not reclassify a Zora owner-install population just because it is inside Base App', () => {
    expect(
      shouldFocusBaseAppWalletSetup({
        inBaseApp: true,
        connectTrack: 'zora-owner-install',
        signingStepComplete: false,
        baseWalletReady: false,
        account: {
          emailVerified: true,
          accountSignals: {
            canonicalCswAddress: CSW,
            canonicalSource: 'wallet_sync',
            linked: true,
          },
        },
      }),
    ).toBe(false)
  })
})

describe('shouldShowBaseAppWalletLinkPanel', () => {
  it('shows link panel in Base App before wallet is ready', () => {
    expect(
      shouldShowBaseAppWalletLinkPanel({
        inBaseApp: true,
        signingStepComplete: false,
        embeddedEoaAvailable: true,
        baseWalletReady: false,
        accountSignals: {
          canonicalCswAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
        },
      }),
    ).toBe(true)
  })
})

describe('shouldShowParentCswAddOwnerPanel', () => {
  it('shows owner install in Base App when wallet is connected', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        inBaseApp: true,
        signingStepComplete: false,
        ownerInstallRequested: false,
        accountSignals: {
          canonicalCswAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
          embeddedEoaAddress: EOA,
        },
        baseWalletReady: true,
      }),
    ).toBe(true)
  })

  it('hides owner install in Base App until the Base Account wallet matches the parent CSW', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        inBaseApp: true,
        signingStepComplete: false,
        ownerInstallRequested: false,
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
        },
        baseWalletReady: false,
      }),
    ).toBe(false)
  })

  it('hides owner install when there is no embedded EOA to add as owner', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        inBaseApp: true,
        signingStepComplete: false,
        ownerInstallRequested: false,
        accountSignals: {
          canonicalCswAddress: CSW,
        },
        baseWalletReady: true,
      }),
    ).toBe(false)
  })

  it('shows owner install for a connected base_account population until on-chain confirmation', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        inBaseApp: true,
        signingStepComplete: false,
        ownerInstallRequested: false,
        connectTrack: 'base-app-direct',
        executionTrack: 'base-app-direct',
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          canonicalSource: 'base_account',
        },
        parentEmbeddedOwnerOnChain: false,
        baseWalletReady: true,
      }),
    ).toBe(true)
  })

  it('shows owner install for Privy-provisioned CSW without Zora link', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        signingStepComplete: false,
        ownerInstallRequested: false,
        connectTrack: 'privy-owner-install',
        zoraLinked: false,
        onchainEoaOwnerCount: 0,
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
        },
      }),
    ).toBe(true)
  })

  it('shows owner install for Zora track when Zora is linked', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        signingStepComplete: false,
        ownerInstallRequested: false,
        connectTrack: 'zora-owner-install',
        zoraLinked: true,
        onchainEoaOwnerCount: 0,
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
        },
      }),
    ).toBe(true)
  })

  it('hides owner install when Privy embedded EOA is already CSW owner', () => {
    expect(
      shouldShowParentCswAddOwnerPanel({
        signingStepComplete: false,
        ownerInstallRequested: false,
        connectTrack: 'privy-owner-install',
        zoraLinked: false,
        onchainEoaOwnerCount: 0,
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        },
      }),
    ).toBe(false)
  })
})

describe('resolveWaitlistConnectTrack', () => {
  it('returns privy-owner-install for email-only CSW + embedded EOA', () => {
    expect(
      resolveWaitlistConnectTrack({
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          executionTrack: 'none-yet',
        },
        zoraLinked: false,
      }),
    ).toBe('privy-owner-install')
  })

  it('returns privy-owner-install when canonical_source is privy_csw', () => {
    expect(
      resolveWaitlistConnectTrack({
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          canonicalSource: 'privy_csw',
          executionTrack: 'none-yet',
        },
        zoraLinked: false,
      }),
    ).toBe('privy-owner-install')
  })

  it('returns zora-owner-install when Zora is linked', () => {
    expect(
      resolveWaitlistConnectTrack({
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          executionTrack: 'none-yet',
          linked: true,
        },
        zoraLinked: true,
      }),
    ).toBe('zora-owner-install')
  })

  it('returns base-app-direct from server execution track', () => {
    expect(
      resolveWaitlistConnectTrack({
        executionTrack: 'base-app-direct',
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          canonicalSource: 'base_account',
        },
      }),
    ).toBe('base-app-direct')
  })

  it('does not short-circuit a Zora population into base-app-direct', () => {
    expect(
      resolveWaitlistConnectTrack({
        executionTrack: 'base-app-direct',
        accountSignals: {
          canonicalCswAddress: CSW,
          embeddedEoaAddress: EOA,
          canonicalSource: 'wallet_sync',
          linked: true,
        },
        zoraLinked: true,
      }),
    ).toBe('zora-owner-install')
  })
})

describe('isWaitlistMessagingSigningReady', () => {
  it('blocks privy-owner-install until embedded owner is on-chain', () => {
    expect(
      isWaitlistMessagingSigningReady({
        connectTrack: 'privy-owner-install',
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })

  it('allows privy-owner-install after embedded owner is on-chain', () => {
    expect(
      isWaitlistMessagingSigningReady({
        connectTrack: 'privy-owner-install',
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe(true)
  })
})

describe('isWaitlistStepTwoSigningComplete', () => {
  it('completes when parent embedded owner is on-chain', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe(true)
  })

  it('does not treat base-app-direct population as embedded-owner completion', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: { executionTrack: 'base-app-direct' },
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })

  it('does not trust a legacy execution-track flag without an on-chain owner result', () => {
    expect(
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: { executionTrack: 'legacy-owner-install' },
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe(false)
  })
})

describe('shouldAutoSubmitOtpCode', () => {
  it('auto-submits a fresh 6-digit code that has not been attempted yet', () => {
    expect(
      shouldAutoSubmitOtpCode({
        step: 'code',
        normalizedCode: '123456',
        codeBusy: false,
        lastAttemptedCode: null,
      }),
    ).toBe(true)
  })

  it('does not re-submit the same code after a failed attempt (regression: retry-loop against Privy)', () => {
    // This is the exact shape that caused a runaway retry loop: verification failed
    // (e.g. wrong code, network error, provider rate limit), codeBusy flipped back to
    // false, but the OTP input still holds the same unchanged 6-digit code.
    expect(
      shouldAutoSubmitOtpCode({
        step: 'code',
        normalizedCode: '123456',
        codeBusy: false,
        lastAttemptedCode: '123456',
      }),
    ).toBe(false)
  })

  it('auto-submits again once the user changes the code after a failed attempt', () => {
    expect(
      shouldAutoSubmitOtpCode({
        step: 'code',
        normalizedCode: '654321',
        codeBusy: false,
        lastAttemptedCode: '123456',
      }),
    ).toBe(true)
  })

  it('does not submit while a verification request is already in flight', () => {
    expect(
      shouldAutoSubmitOtpCode({
        step: 'code',
        normalizedCode: '123456',
        codeBusy: true,
        lastAttemptedCode: null,
      }),
    ).toBe(false)
  })

  it('does not submit an incomplete code', () => {
    expect(
      shouldAutoSubmitOtpCode({
        step: 'code',
        normalizedCode: '12345',
        codeBusy: false,
        lastAttemptedCode: null,
      }),
    ).toBe(false)
  })

  it('does not submit outside the code step', () => {
    expect(
      shouldAutoSubmitOtpCode({
        step: 'email',
        normalizedCode: '123456',
        codeBusy: false,
        lastAttemptedCode: null,
      }),
    ).toBe(false)
  })
})

describe('resolveWaitlistOtpSubmitPhase', () => {
  it('prefers setting_up over verified while bootstrap is still in flight after OTP success', () => {
    // Regression: success used to win over busy and left the button on static "Verified"
    // for the full session-bridge gap with no progress signal.
    expect(resolveWaitlistOtpSubmitPhase({ codeStatus: 'success', codeBusy: true })).toBe('setting_up')
    expect(getWaitlistOtpSubmitLabel('setting_up')).toBe('Setting up your account…')
    expect(getWaitlistOtpSubmitHelperText('setting_up')).toBe('This usually takes a few seconds.')
  })

  it('shows verifying while Privy OTP check is in flight before success', () => {
    expect(resolveWaitlistOtpSubmitPhase({ codeStatus: 'default', codeBusy: true })).toBe('verifying')
    expect(getWaitlistOtpSubmitLabel('verifying')).toBe('Verifying…')
    expect(getWaitlistOtpSubmitHelperText('verifying')).toBeNull()
  })

  it('shows verified only after success when join is no longer busy', () => {
    expect(resolveWaitlistOtpSubmitPhase({ codeStatus: 'success', codeBusy: false })).toBe('verified')
    expect(getWaitlistOtpSubmitLabel('verified')).toBe('Verified')
  })

  it('stays idle when the user can still submit', () => {
    expect(resolveWaitlistOtpSubmitPhase({ codeStatus: 'default', codeBusy: false })).toBe('idle')
    expect(resolveWaitlistOtpSubmitPhase({ codeStatus: 'error', codeBusy: false })).toBe('idle')
    expect(getWaitlistOtpSubmitLabel('idle')).toBe('Verify & join')
    expect(getWaitlistOtpSubmitHelperText('idle')).toBeNull()
  })
})

describe('resolveWaitlistOtpInputStatus', () => {
  it('does not turn the digit cells green while account setup is still running', () => {
    // Regression: the cells used to mirror `codeStatus` directly, so they went green
    // the instant the code was accepted even though bootstrap was still in flight.
    expect(resolveWaitlistOtpInputStatus({ codeStatus: 'success', codeBusy: true })).toBe('default')
  })

  it('turns the digit cells green only once fully verified and no longer busy', () => {
    expect(resolveWaitlistOtpInputStatus({ codeStatus: 'success', codeBusy: false })).toBe('success')
  })

  it('shows error styling immediately regardless of busy state', () => {
    expect(resolveWaitlistOtpInputStatus({ codeStatus: 'error', codeBusy: false })).toBe('error')
    expect(resolveWaitlistOtpInputStatus({ codeStatus: 'error', codeBusy: true })).toBe('error')
  })

  it('stays default while verifying', () => {
    expect(resolveWaitlistOtpInputStatus({ codeStatus: 'default', codeBusy: true })).toBe('default')
  })
})
