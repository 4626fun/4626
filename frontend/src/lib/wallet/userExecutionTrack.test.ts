import { describe, expect, it } from 'vitest'

import {
  buildWaitlistStepRoutingParams,
  deriveAccountChromeExecution,
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
        accountSignals: { executionTrack: 'none-yet' },
      }),
    ).toBe(true)
  })
})

describe('shouldUseBaseAppSubAccountPath', () => {
  it('returns false for parent-owner accounts', () => {
    expect(
      shouldUseBaseAppSubAccountPath({
        subAccountFlowEnabled: true,
        parentEmbeddedOwnerOnChain: true,
        accountSignals: {
          executionTrack: 'none-yet',
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
  it('promotes parent-owner execution over none-yet track', () => {
    expect(
      resolveEffectiveExecutionTrack({
        executionTrack: 'none-yet',
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe('legacy-owner-install')
  })

  it('returns none-yet when no owner is confirmed', () => {
    expect(
      resolveEffectiveExecutionTrack({
        executionTrack: 'none-yet',
        parentEmbeddedOwnerOnChain: false,
      }),
    ).toBe('none-yet')
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

describe('deriveAccountChromeExecution', () => {
  const csw = '0xAb6d5c10b03300326cd7fab7267ae192842967b5'

  it('returns parent-csw chrome when parent-owner is on-chain', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'none-yet',
      parentEmbeddedOwnerOnChain: true,
      subAccountFlowEnabled: true,
      canonicalCswAddress: csw,
    })

    expect(chrome.mode).toBe('parent-csw')
    expect(chrome.showSubAccountInTray).toBe(false)
    expect(chrome.showSubAccountInAccounts).toBe(false)
    expect(chrome.subAccountAddress).toBeNull()
    expect(chrome.swapSenderLabel).toContain('Coinbase Smart Wallet')
  })

  it('returns none chrome when no owner is confirmed', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'none-yet',
      subAccountFlowEnabled: false,
      canonicalCswAddress: csw,
    })

    expect(chrome.mode).toBe('none')
    expect(chrome.showSubAccountInTray).toBe(false)
  })
})
