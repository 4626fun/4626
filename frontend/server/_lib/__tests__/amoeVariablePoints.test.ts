// PR 2 — AMOE Linear Parity (variable points) unit tests.
//
// Locks in the off-chain math that mirrors PR 1's on-chain
// `CreatorLotteryManager.calculateWinChance` so the UI's win-chance preview
// can never silently drift from the contract. The on-chain value is the
// authoritative source — these helpers exist purely to:
//
//   1. Convert the user's points selection (UI integer in [100, 1_000_000])
//      into the USDC 1e6 value `processAmoeEntry` expects.
//   2. Display "Win chance: 0.0X%" in the AmoeEntryCard before the user
//      commits.
//
// The boundary table below is the same one in
// `docs/security/amoe-pr2-handoff.md` — keep them in sync.

import { describe, expect, it } from 'vitest'

import {
  AMOE_MAX_POINTS_PER_SUBMISSION,
  AMOE_MIN_POINTS_PER_SUBMISSION,
  AMOE_POINTS_TO_USD1E6_FACTOR,
  estimateWinChancePPM,
  pointsToUsd1e6,
} from '../lottery/lotteryAmoe.js'
import { AmoeBadRequestError } from '../lottery/lotteryAmoeErrors.js'

describe('AMOE variable points — pointsToUsd1e6', () => {
  it('exports the locked min/max/conversion constants', () => {
    expect(AMOE_MIN_POINTS_PER_SUBMISSION).toBe(100)
    expect(AMOE_MAX_POINTS_PER_SUBMISSION).toBe(1_000_000)
    // 100 points = $1 = 1e6 USDC units → factor must be 10_000.
    expect(AMOE_POINTS_TO_USD1E6_FACTOR).toBe(10_000)
  })

  it('maps the floor (100 points) to $1 (1_000_000)', () => {
    expect(pointsToUsd1e6(100)).toBe(1_000_000n)
  })

  it('maps 10_000 points to $100 (100_000_000)', () => {
    expect(pointsToUsd1e6(10_000)).toBe(100_000_000n)
  })

  it('maps the ceiling (1_000_000 points) to $10K (10_000_000_000)', () => {
    expect(pointsToUsd1e6(1_000_000)).toBe(10_000_000_000n)
  })

  it('rejects below-floor values', () => {
    expect(() => pointsToUsd1e6(99)).toThrow(AmoeBadRequestError)
    expect(() => pointsToUsd1e6(0)).toThrow(AmoeBadRequestError)
    expect(() => pointsToUsd1e6(-1)).toThrow(AmoeBadRequestError)
  })

  it('rejects above-ceiling values', () => {
    expect(() => pointsToUsd1e6(1_000_001)).toThrow(AmoeBadRequestError)
    expect(() => pointsToUsd1e6(Number.MAX_SAFE_INTEGER)).toThrow(AmoeBadRequestError)
  })

  it('rejects non-integer / non-finite values', () => {
    expect(() => pointsToUsd1e6(100.5)).toThrow(AmoeBadRequestError)
    expect(() => pointsToUsd1e6(Number.NaN)).toThrow(AmoeBadRequestError)
    expect(() => pointsToUsd1e6(Number.POSITIVE_INFINITY)).toThrow(AmoeBadRequestError)
  })
})

describe('AMOE variable points — estimateWinChancePPM', () => {
  // Mirrors PR 1's on-chain formula:
  //   winChancePPM = swapValueUSD / 250_000, capped at baseCeilingPPM (40_000)
  //   sub-floor (< $1) returns 0
  //
  // Boundary table (same as docs/security/amoe-pr2-handoff.md):
  //   $1     → 4 PPM        (0.0004%)
  //   $10    → 40 PPM       (0.004%)
  //   $100   → 400 PPM      (0.04%)
  //   $1K    → 4_000 PPM    (0.4%)
  //   $10K   → 40_000 PPM   (4%, ceiling)
  //   $100K  → 40_000 PPM   (saturates)

  it('returns 0 below the $1 floor', () => {
    expect(estimateWinChancePPM(0n)).toBe(0)
    expect(estimateWinChancePPM(999_999n)).toBe(0)
  })

  it('returns 4 PPM at exactly $1', () => {
    expect(estimateWinChancePPM(1_000_000n)).toBe(4)
  })

  it('returns 40 PPM at $10', () => {
    expect(estimateWinChancePPM(10_000_000n)).toBe(40)
  })

  it('returns 400 PPM at $100', () => {
    expect(estimateWinChancePPM(100_000_000n)).toBe(400)
  })

  it('returns 4_000 PPM at $1,000', () => {
    expect(estimateWinChancePPM(1_000_000_000n)).toBe(4_000)
  })

  it('returns the 40_000 PPM ceiling at $10K', () => {
    expect(estimateWinChancePPM(10_000_000_000n)).toBe(40_000)
  })

  it('saturates at the 40_000 PPM ceiling for >$10K values', () => {
    expect(estimateWinChancePPM(100_000_000_000n)).toBe(40_000) // $100K
    expect(estimateWinChancePPM(10n ** 18n)).toBe(40_000) // 1e18, way over
  })
})

describe('AMOE variable points — pointsToUsd1e6 + estimateWinChancePPM end-to-end', () => {
  // The UI composes these two functions to render the live preview, so lock
  // the composition for every spec'd boundary.
  it.each([
    [100, 4], //       $1 → 0.0004%
    [1_000, 40], //    $10 → 0.004%
    [10_000, 400], //  $100 → 0.04%
    [100_000, 4_000], // $1K → 0.4%
    [1_000_000, 40_000], // $10K → 4% (ceiling)
  ])('points=%i → win chance %i PPM', (points, expectedPPM) => {
    expect(estimateWinChancePPM(pointsToUsd1e6(points))).toBe(expectedPPM)
  })
})
