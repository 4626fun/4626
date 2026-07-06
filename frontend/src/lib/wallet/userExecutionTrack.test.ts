import { describe, expect, it } from 'vitest'

import {
  buildWaitlistStepRoutingParams,
  deriveAccountChromeExecution,
  inferWaitlistEoaOwnerRoutingHint,
  isParentCswEmbeddedOwnerReady,
  isZoraLinkedFromAccountSignals,
  resolveEffectiveExecutionTrack,
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

describe('inferWaitlistEoaOwnerRoutingHint', () => {
  it('uses on-chain owner count when provided', () => {
    expect(inferWaitlistEoaOwnerRoutingHint({ onchainEoaOwnerCount: 2 })).toBe(2)
  })
})

describe('deriveAccountChromeExecution', () => {
  it('uses parent CSW lane when legacy owner install is active', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'legacy-owner-install',
      parentEmbeddedOwnerOnChain: true,
      canonicalCswAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
    })
    expect(chrome.mode).toBe('parent-csw')
    expect(chrome.swapSenderLabel).toContain('Coinbase Smart Wallet')
  })

  it('returns none mode when signing is not ready', () => {
    const chrome = deriveAccountChromeExecution({
      executionTrack: 'none-yet',
      parentEmbeddedOwnerOnChain: false,
    })
    expect(chrome.mode).toBe('none')
    expect(chrome.swapSenderLabel).toBeNull()
  })
})

describe('buildWaitlistStepRoutingParams', () => {
  it('passes embedded EOA availability through routing params', () => {
    const params = buildWaitlistStepRoutingParams(
      {
        emailVerified: true,
        appAccessStatus: 'linked',
        accountSignals: { executionTrack: 'none-yet' },
      },
      {
        embeddedEoaAvailable: true,
        parentEmbeddedOwnerOnChain: false,
      },
    )
    expect(params.embeddedEoaAvailable).toBe(true)
    expect(params.onchainEoaOwnerCount).toBe(0)
  })
})
