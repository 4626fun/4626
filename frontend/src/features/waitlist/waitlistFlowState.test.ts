import { describe, expect, it } from 'vitest'

import {
  isWaitlistStepTwoSigningComplete,
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
