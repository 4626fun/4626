import { describe, expect, it } from 'vitest'
import {
  WAITLIST_TIERS,
  computeProgress,
  getTier,
  tierFromPoints,
} from './waitlistTiers'

describe('tierFromPoints', () => {
  it('returns 0 for sub-threshold and invalid inputs', () => {
    expect(tierFromPoints(0)).toBe(0)
    expect(tierFromPoints(39)).toBe(0)
    expect(tierFromPoints(-5)).toBe(0)
    expect(tierFromPoints(Number.NaN)).toBe(0)
  })

  it('matches the server toScoreTier thresholds', () => {
    expect(tierFromPoints(40)).toBe(1)
    expect(tierFromPoints(119)).toBe(1)
    expect(tierFromPoints(120)).toBe(2)
    expect(tierFromPoints(249)).toBe(2)
    expect(tierFromPoints(250)).toBe(3)
    expect(tierFromPoints(10_000)).toBe(3)
  })
})

describe('getTier', () => {
  it('returns the matching record for each tier id', () => {
    for (const tier of WAITLIST_TIERS) {
      expect(getTier(tier.id)).toBe(tier)
    }
  })
})

describe('computeProgress', () => {
  it('handles a brand-new signup with 0 points', () => {
    const progress = computeProgress(0)
    expect(progress.currentTier.id).toBe(0)
    expect(progress.nextTier?.id).toBe(1)
    expect(progress.pointsToNext).toBe(40)
    expect(progress.progressPercent).toBe(0)
  })

  it('computes a mid-tier progress percent between thresholds', () => {
    const progress = computeProgress(80)
    expect(progress.currentTier.id).toBe(1)
    expect(progress.nextTier?.id).toBe(2)
    expect(progress.pointsToNext).toBe(40)
    expect(progress.progressPercent).toBeGreaterThan(0)
    expect(progress.progressPercent).toBeLessThan(100)
  })

  it('caps at tier 3 with no next tier', () => {
    const progress = computeProgress(999)
    expect(progress.currentTier.id).toBe(3)
    expect(progress.nextTier).toBeNull()
    expect(progress.pointsToNext).toBe(0)
    expect(progress.progressPercent).toBe(100)
  })

  it('clamps progress between 0 and 100', () => {
    expect(computeProgress(-100).progressPercent).toBe(0)
    expect(computeProgress(10_000).progressPercent).toBe(100)
  })

  it('returns exact boundary behavior at tier upgrade points', () => {
    const atTier2Threshold = computeProgress(120)
    expect(atTier2Threshold.currentTier.id).toBe(2)
    expect(atTier2Threshold.progressPercent).toBe(0)
    expect(atTier2Threshold.pointsToNext).toBe(130)
  })
})
