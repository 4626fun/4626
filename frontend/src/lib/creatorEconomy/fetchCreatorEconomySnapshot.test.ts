import { describe, expect, it } from 'vitest'

import { summarizeTrayConnections } from './connectionsSummary'
import {
  deriveAuctionState,
  deriveBundleStatus,
  deriveSettlementComplete,
} from './fetchCreatorEconomySnapshot'

describe('creator economy fetch helpers', () => {
  it('derives auction states from API flags without treating isActive alone as graduated', () => {
    expect(deriveAuctionState(null)).toBe('none')
    expect(deriveAuctionState({ isActive: true })).toBe('live')
    expect(deriveAuctionState({ lifecyclePhase: 7 })).toBe('scheduled')
    expect(deriveAuctionState({ isGraduated: true })).toBe('graduated')
    expect(deriveAuctionState({ lifecycleFailedFinalized: true })).toBe('failed')
  })

  it('requires both currencySwept and migrated for settlement', () => {
    expect(deriveSettlementComplete({ lifecycleCurrencySwept: true, lifecycleMigrated: false })).toBe(
      false,
    )
    expect(deriveSettlementComplete({ lifecycleCurrencySwept: true, lifecycleMigrated: true })).toBe(
      true,
    )
  })

  it('never requires a paywall once a vault exists or stack is legacy', () => {
    expect(
      deriveBundleStatus({
        hasVault: true,
        isLegacyStack: false,
        deployPlan: null,
      }),
    ).toBe('not_required')
    expect(
      deriveBundleStatus({
        hasVault: false,
        isLegacyStack: true,
        deployPlan: null,
      }),
    ).toBe('not_required')
    expect(
      deriveBundleStatus({
        hasVault: false,
        isLegacyStack: false,
        deployPlan: null,
      }),
    ).toBe('required')
  })
})

describe('summarizeTrayConnections', () => {
  it('counts the seven social channels and recommends the next bonus', () => {
    const summary = summarizeTrayConnections({
      privyUserId: 'did:privy:test',
      email: 'a@b.co',
      emailVerified: true,
      appAccessStatus: null,
      baseSubAccount: null,
      linkedMethods: { google: ['g'] },
      accountSignals: {
        linked: true,
        canonicalCswAddress: null,
        canonicalSource: null,
        baseSubAccount: { address: null, registered: false, isDistinctFromCsw: false },
        executionTrack: 'none-yet',
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
        creatorCoin: null,
        zoraHandle: null,
        basename: null,
        primaryWalletAddress: null,
        embeddedEoaAddress: null,
        lastResolvedAt: null,
      },
      score: { points: 0, tier: 0 },
    })
    expect(summary.total).toBe(7)
    expect(summary.linked).toBe(2)
    expect(summary.nextBonus).toEqual({ label: 'Connect Apple', points: 20 })
  })
})
