import { describe, expect, it } from 'vitest'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import { mergeBootstrapSignals, type BootstrapExecutionSignals } from '@/lib/account/mergeAccountMeBootstrap'

const baseSubAccountNone = { address: null, registered: false, isDistinctFromCsw: false }

function makePayload(overrides: Partial<AccountSetupMe> = {}): AccountSetupMe {
  return {
    privyUserId: 'privy-123',
    email: 'test@example.com',
    emailVerified: true,
    appAccessStatus: 'accepted',
    baseSubAccount: null,
    linkedMethods: {},
    accountSignals: {
      linked: false,
      canonicalCswAddress: null,
      baseSubAccount: baseSubAccountNone,
      executionTrack: 'none-yet',
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: null,
    },
    score: { points: 0, tier: 0 },
    ...overrides,
  }
}

function makeBootstrap(overrides: Partial<BootstrapExecutionSignals> = {}): BootstrapExecutionSignals {
  return {
    canonicalCswAddress: '0xCSW',
    privyEmbeddedEoaAddress: '0xEOA',
    executionTrack: 'legacy-owner-install',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
    baseSubAccount: { address: '0xSUB', registered: true, isDistinctFromCsw: true },
    ...overrides,
  }
}

describe('mergeBootstrapSignals (R7: concurrent fetch merge consistency)', () => {
  it('fills in missing executionTrack and canonicalCswAddress from bootstrap when payload has none-yet', () => {
    const payload = makePayload()
    const bootstrap = makeBootstrap()
    const merged = mergeBootstrapSignals(payload, bootstrap)
    expect(merged.accountSignals.executionTrack).toBe('legacy-owner-install')
    expect(merged.accountSignals.canonicalCswAddress).toBe('0xCSW')
    expect(merged.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(true)
  })

  it('preserves payload executionTrack when already populated (does not overwrite with bootstrap)', () => {
    const payload = makePayload({
      accountSignals: {
        linked: true,
        canonicalCswAddress: '0xCSW',
        baseSubAccount: { address: '0xPAYLOAD_SUB', registered: true, isDistinctFromCsw: true },
        executionTrack: 'legacy-owner-install',
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
        creatorCoin: null,
        zoraHandle: 'test',
        lastResolvedAt: '2026-01-01',
      },
    })
    const bootstrap = makeBootstrap()
    const merged = mergeBootstrapSignals(payload, bootstrap)
    expect(merged.accountSignals.executionTrack).toBe('legacy-owner-install')
    expect(merged.accountSignals.baseSubAccount.address).toBe('0xPAYLOAD_SUB')
    expect(merged.accountSignals.canonicalCswAddress).toBe('0xCSW')
  })

  it('upgrades owner flag from null to true when bootstrap confirms ownership', () => {
    const payload = makePayload({
      accountSignals: {
        ...makePayload().accountSignals,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
      },
    })
    const bootstrap = makeBootstrap({ privyEmbeddedEoaIsOwnerOfCanonicalCsw: true })
    const merged = mergeBootstrapSignals(payload, bootstrap)
    expect(merged.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(true)
  })

  it('does not downgrade owner flag from true to null when bootstrap lacks ownership', () => {
    const payload = makePayload({
      accountSignals: {
        ...makePayload().accountSignals,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      },
    })
    const bootstrap = makeBootstrap({ privyEmbeddedEoaIsOwnerOfCanonicalCsw: false })
    const merged = mergeBootstrapSignals(payload, bootstrap)
    expect(merged.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(true)
  })
})
