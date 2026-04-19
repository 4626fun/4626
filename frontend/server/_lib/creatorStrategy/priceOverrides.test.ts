import { describe, expect, it } from 'vitest'

import { applyPriceOverride, type PriceOverrideRow } from './priceOverrides'

function makeOverride(priceUsdcOverride: bigint): PriceOverrideRow {
  return {
    id: 42,
    creatorToken: null,
    walletAddress: null,
    featureKey: 'charm_active_lp',
    priceUsdcOverride,
    reason: 'partner',
    grantedBy: '0xoperator',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-04-19T00:00:00Z',
  }
}

describe('applyPriceOverride', () => {
  it('returns catalog price + null metadata when no override', () => {
    const res = applyPriceOverride(100_000_000n, null)
    expect(res.effectivePriceUsdc).toBe(100_000_000n)
    expect(res.appliedOverrideId).toBe(null)
    expect(res.discountBps).toBe(null)
  })

  it('applies a 50% discount cleanly', () => {
    const res = applyPriceOverride(100_000_000n, makeOverride(50_000_000n))
    expect(res.effectivePriceUsdc).toBe(50_000_000n)
    expect(res.appliedOverrideId).toBe(42)
    expect(res.discountBps).toBe(5_000)
  })

  it('allows a $0 comp (free activation)', () => {
    const res = applyPriceOverride(100_000_000n, makeOverride(0n))
    expect(res.effectivePriceUsdc).toBe(0n)
    expect(res.discountBps).toBe(10_000)
  })

  it('clamps a malformed "override higher than catalog" row to catalog price', () => {
    // Defensive: if someone inserts a bogus override that would RAISE
    // the price, the handler still charges at most the catalog price.
    const res = applyPriceOverride(100_000_000n, makeOverride(500_000_000n))
    expect(res.effectivePriceUsdc).toBe(100_000_000n)
    expect(res.discountBps).toBe(0)
    expect(res.appliedOverrideId).toBe(42)
  })

  it('produces no discountBps when catalog price is zero', () => {
    const res = applyPriceOverride(0n, makeOverride(0n))
    expect(res.effectivePriceUsdc).toBe(0n)
    expect(res.discountBps).toBe(null)
  })
})
