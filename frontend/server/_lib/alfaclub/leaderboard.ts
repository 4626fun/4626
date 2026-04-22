/**
 * Pure leaderboard scoring — no network calls, no DB, fully deterministic.
 *
 * Inputs:
 *   - Per-creator AlfaClub metrics (FriendKey totalSupply, FriendStake staked supply).
 *   - Optional Hyperliquid snapshot (30d realized PnL + account value).
 *
 * Output:
 *   - A sorted list of `RankedCreator` with stable tie-breaking.
 *
 * Weights and clamps are exposed so downstream code and tests can verify
 * them against fixtures.
 */

import type { Address } from 'viem'

// ---------------------------------------------------------------------------
// Tunables (the composite score is intentionally simple + transparent)
// ---------------------------------------------------------------------------

export const LEADERBOARD_WEIGHTS = {
  popularity: 0.4,
  performance: 0.6,
} as const

/**
 * Soft caps for normalization. These are log-scale caps — they control
 * how much a single huge room or a single huge PnL entry can dominate.
 * Chosen generously so the median room lands in the 0.2-0.5 range.
 */
export const LEADERBOARD_CAPS = {
  supplyLog10Cap: 5, // ~100k keys before saturation
  stakeLog10Cap: 5,
  pnlAbsCapUsd: 1_000_000, // PnL above ±$1M caps at ±1.0 after normalization
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreatorMetricsInput = {
  tokenId: bigint
  creatorAddress: Address
  totalSupply: bigint
  stakedSupply: bigint
  hyperliquid: {
    accountValueUsd: number | null
    pnl30dUsd: number | null
  } | null
}

export type RankedCreator = {
  rank: number
  tokenId: bigint
  creatorAddress: Address
  totalSupply: bigint
  stakedSupply: bigint
  hyperliquid: {
    accountValueUsd: number | null
    pnl30dUsd: number | null
  } | null
  popularityScore: number
  performanceScore: number
  compositeScore: number
}

// ---------------------------------------------------------------------------
// Score functions
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function bigIntToSafeNumber(value: bigint): number {
  if (value <= 0n) return 0
  const cap = BigInt(Number.MAX_SAFE_INTEGER)
  if (value > cap) return Number.MAX_SAFE_INTEGER
  return Number(value)
}

/**
 * Popularity score in [0, 1]. Log-scales supply + stake so a room with
 * 100 keys and a room with 10 keys don't get the same score, but a 100k
 * key room doesn't utterly dominate either.
 *
 * supplyComponent = log10(1 + totalSupply)  / supplyLog10Cap
 * stakeComponent  = log10(1 + stakedSupply) / stakeLog10Cap
 * popularity      = 0.5 * supplyComponent + 0.5 * stakeComponent (clamped to [0,1])
 */
export function popularityScore(
  totalSupply: bigint,
  stakedSupply: bigint,
): number {
  const s = bigIntToSafeNumber(totalSupply)
  const st = bigIntToSafeNumber(stakedSupply)
  const supplyComponent = Math.log10(1 + s) / LEADERBOARD_CAPS.supplyLog10Cap
  const stakeComponent = Math.log10(1 + st) / LEADERBOARD_CAPS.stakeLog10Cap
  return clamp(0.5 * supplyComponent + 0.5 * stakeComponent, 0, 1)
}

/**
 * Performance score in [-1, 1] normalized against `pnlAbsCapUsd`.
 * Creators with `null` PnL (no Hyperliquid activity, or the endpoint
 * failed) receive 0 — neither rewarded nor punished.
 */
export function performanceScore(pnl30dUsd: number | null): number {
  if (pnl30dUsd === null || !Number.isFinite(pnl30dUsd)) return 0
  const normalized = pnl30dUsd / LEADERBOARD_CAPS.pnlAbsCapUsd
  return clamp(normalized, -1, 1)
}

/**
 * Composite score in [-1, 1] (mostly 0..1 for most creators).
 * Exposed so the scorecard builder and tests stay in lockstep.
 */
export function compositeScore(
  pop: number,
  perf: number,
  weights = LEADERBOARD_WEIGHTS,
): number {
  return weights.popularity * pop + weights.performance * perf
}

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

/**
 * Rank a list of creators by compositeScore (desc). Ties broken by:
 *   1. higher totalSupply
 *   2. lower tokenId (earlier room)
 *   3. lexicographic creatorAddress
 *
 * Deterministic — same input always produces same output.
 */
export function rankCreators(
  metrics: readonly CreatorMetricsInput[],
): RankedCreator[] {
  const scored = metrics.map((m) => {
    const pop = popularityScore(m.totalSupply, m.stakedSupply)
    const perf = performanceScore(m.hyperliquid?.pnl30dUsd ?? null)
    return {
      tokenId: m.tokenId,
      creatorAddress: m.creatorAddress.toLowerCase() as Address,
      totalSupply: m.totalSupply,
      stakedSupply: m.stakedSupply,
      hyperliquid: m.hyperliquid,
      popularityScore: pop,
      performanceScore: perf,
      compositeScore: compositeScore(pop, perf),
    }
  })

  scored.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore
    }
    if (a.totalSupply !== b.totalSupply) {
      return b.totalSupply > a.totalSupply ? 1 : -1
    }
    if (a.tokenId !== b.tokenId) {
      return a.tokenId > b.tokenId ? 1 : -1
    }
    return a.creatorAddress.localeCompare(b.creatorAddress)
  })

  return scored.map((s, index) => ({
    rank: index + 1,
    ...s,
  }))
}
