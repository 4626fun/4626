import { describe, expect, it } from 'vitest'

import {
  isWaitlistStepTwoSigningComplete,
  shouldAutoSubmitOtpCode,
  shouldFocusBaseAppWalletSetup,
  shouldShowBaseAppWalletLinkPanel,
  shouldShowParentCswAddOwnerPanel,
} from './waitlistFlowState'

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
        },
        baseWalletReady: true,
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
