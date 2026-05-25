import { describe, expect, it } from 'vitest'

import {
  buildWaitlistStepRoutingParams,
  inferWaitlistEoaOwnerRoutingHint,
  isParentCswEmbeddedOwnerReady,
  isZoraLinkedFromAccountSignals,
  resolveEffectiveExecutionTrack,
  shouldUseBaseAppSubAccountPath,
} from './userExecutionTrack'

describe('isParentCswEmbeddedOwnerReady', () => {
  it('prefers on-chain owner confirmation', () => {
    expect(
      isParentCswEmbeddedOwnerReady({
        parentEmbeddedOwnerOnChain: true,
        accountSignals: { executionTrack: 'sub-account' },
      }),
    ).toBe(true)
  })
})

describe('shouldUseBaseAppSubAccountPath', () => {
  it('returns false for population c even with stale sub-account track', () => {
    expect(
      shouldUseBaseAppSubAccountPath({
        subAccountFlowEnabled: true,
        parentEmbeddedOwnerOnChain: true,
        accountSignals: {
          executionTrack: 'sub-account',
          baseSubAccount: { registered: true, isDistinctFromCsw: true },
        },
      }),
    ).toBe(false)
  })

  it('returns false for Zora-linked accounts with an EOA-owner routing hint', () => {
    expect(
      shouldUseBaseAppSubAccountPath({
        subAccountFlowEnabled: true,
        accountSignals: {
          linked: true,
          executionTrack: 'legacy-owner-install',
        },
      }),
    ).toBe(false)
  })
})

describe('resolveEffectiveExecutionTrack', () => {
  it('promotes parent-owner execution over sub-account track', () => {
    expect(
      resolveEffectiveExecutionTrack({
        executionTrack: 'sub-account',
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe('legacy-owner-install')
  })
})

describe('isZoraLinkedFromAccountSignals', () => {
  it('detects linked Zora accounts from accountSignals.linked', () => {
    expect(isZoraLinkedFromAccountSignals({ linked: true })).toBe(true)
  })

  it('detects linked Zora accounts from creator coin metadata', () => {
    expect(
      isZoraLinkedFromAccountSignals({
        creatorCoin: { address: '0x1234567890123456789012345678901234567890' },
      }),
    ).toBe(true)
  })
})

describe('buildWaitlistStepRoutingParams', () => {
  it('fills zora and EOA-owner hints from account signals', () => {
    const params = buildWaitlistStepRoutingParams(
      {
        emailVerified: true,
        appAccessStatus: null,
        accountSignals: {
          linked: true,
          executionTrack: 'legacy-owner-install',
          canonicalCswAddress: '0x1234567890123456789012345678901234567890',
        },
      },
      {
        subAccountFlowEnabled: true,
        embeddedEoaAvailable: true,
      },
    )

    expect(params.zoraLinked).toBe(true)
    expect(params.onchainEoaOwnerCount).toBe(1)
  })
})

describe('inferWaitlistEoaOwnerRoutingHint', () => {
  it('uses explicit owner counts when provided', () => {
    expect(
      inferWaitlistEoaOwnerRoutingHint({
        onchainEoaOwnerCount: 2,
        accountSignals: { executionTrack: 'none-yet' },
      }),
    ).toBe(2)
  })
})
