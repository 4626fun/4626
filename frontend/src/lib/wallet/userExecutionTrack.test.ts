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

describe('deriveAccountChromeExecution', () => {
  const csw = '0xAb6d5c10b03300326cd7fab7267ae192842967b5'
  const subAccount = '0x1111111111111111111111111111111111111111'

  it('hides sub-account chrome for population c with stale sub-account DB state', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'sub-account',
      parentEmbeddedOwnerOnChain: true,
      subAccountFlowEnabled: true,
      canonicalCswAddress: csw,
      baseSubAccount: {
        address: subAccount,
        registered: true,
        isDistinctFromCsw: true,
      },
    })

    expect(chrome.mode).toBe('parent-csw')
    expect(chrome.showSubAccountInTray).toBe(false)
    expect(chrome.showSubAccountInAccounts).toBe(false)
    expect(chrome.subAccountAddress).toBeNull()
    expect(chrome.swapSenderLabel).toContain('Coinbase Smart Wallet')
  })

  it('surfaces sub-account chrome for population b when flags are on', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'sub-account',
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
      subAccountFlowEnabled: true,
      canonicalCswAddress: csw,
      baseSubAccount: {
        address: subAccount,
        registered: true,
        isDistinctFromCsw: true,
      },
    })

    expect(chrome.mode).toBe('sub-account')
    expect(chrome.showSubAccountInTray).toBe(true)
    expect(chrome.showSubAccountInAccounts).toBe(true)
    expect(chrome.subAccountAddress).toBe(subAccount)
    expect(chrome.swapSenderLabel).toContain('4626 app wallet')
  })

  it('does not surface sub-account chrome when the sub-account flag is off', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'sub-account',
      subAccountFlowEnabled: false,
      canonicalCswAddress: csw,
      baseSubAccount: {
        address: subAccount,
        registered: true,
        isDistinctFromCsw: true,
      },
    })

    expect(chrome.mode).toBe('none')
    expect(chrome.showSubAccountInTray).toBe(false)
  })
})
