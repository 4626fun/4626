import { describe, it, expect } from 'vitest'

import {
  LEADERBOARD_CAPS,
  LEADERBOARD_WEIGHTS,
  compositeScore,
  performanceScore,
  popularityScore,
  rankCreators,
  type CreatorMetricsInput,
} from '../../server/_lib/alfaclub/leaderboard.ts'

function creator(params: {
  addr: string
  tokenId: bigint
  supply: bigint
  staked: bigint
  pnl?: number | null
  accountValue?: number | null
}): CreatorMetricsInput {
  return {
    tokenId: params.tokenId,
    creatorAddress: params.addr as `0x${string}`,
    totalSupply: params.supply,
    stakedSupply: params.staked,
    hyperliquid:
      params.pnl === undefined && params.accountValue === undefined
        ? null
        : {
            accountValueUsd: params.accountValue ?? null,
            pnl30dUsd: params.pnl ?? null,
          },
  }
}

describe('leaderboard — popularityScore', () => {
  it('returns 0 for a room with zero supply and zero stake', () => {
    expect(popularityScore(0n, 0n)).toBe(0)
  })

  it('is monotonically increasing with supply', () => {
    const a = popularityScore(10n, 0n)
    const b = popularityScore(100n, 0n)
    const c = popularityScore(1_000n, 0n)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('saturates at 1 well past the log cap', () => {
    const huge = 10n ** BigInt(LEADERBOARD_CAPS.supplyLog10Cap + 3)
    expect(popularityScore(huge, huge)).toBe(1)
  })
})

describe('leaderboard — performanceScore', () => {
  it('returns 0 for null pnl (fail-open)', () => {
    expect(performanceScore(null)).toBe(0)
  })

  it('clamps to [-1, 1]', () => {
    expect(performanceScore(LEADERBOARD_CAPS.pnlAbsCapUsd * 10)).toBe(1)
    expect(performanceScore(-LEADERBOARD_CAPS.pnlAbsCapUsd * 10)).toBe(-1)
  })

  it('linear between cap bounds', () => {
    expect(performanceScore(LEADERBOARD_CAPS.pnlAbsCapUsd / 2)).toBeCloseTo(0.5, 5)
    expect(performanceScore(-LEADERBOARD_CAPS.pnlAbsCapUsd / 4)).toBeCloseTo(-0.25, 5)
  })
})

describe('leaderboard — compositeScore', () => {
  it('applies the published weights', () => {
    expect(compositeScore(1, 1)).toBeCloseTo(
      LEADERBOARD_WEIGHTS.popularity + LEADERBOARD_WEIGHTS.performance,
      6,
    )
    expect(compositeScore(0, 0)).toBe(0)
  })
})

describe('leaderboard — rankCreators', () => {
  const creators = [
    creator({
      addr: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tokenId: 1n,
      supply: 100n,
      staked: 50n,
      pnl: 400_000,
    }),
    creator({
      addr: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      tokenId: 2n,
      supply: 1_000n,
      staked: 900n,
      pnl: -200_000,
    }),
    creator({
      addr: '0xcccccccccccccccccccccccccccccccccccccccc',
      tokenId: 3n,
      supply: 10n,
      staked: 0n,
      pnl: null,
    }),
    creator({
      addr: '0xdddddddddddddddddddddddddddddddddddddddd',
      tokenId: 4n,
      supply: 5_000n,
      staked: 4_000n,
      pnl: 800_000,
    }),
    creator({
      addr: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenId: 5n,
      supply: 500n,
      staked: 250n,
      pnl: 100_000,
    }),
  ]

  it('assigns consecutive ranks 1..N', () => {
    const ranked = rankCreators(creators)
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('places the top performer (high pnl + big supply) at rank 1', () => {
    const ranked = rankCreators(creators)
    expect(ranked[0]?.creatorAddress).toBe('0xdddddddddddddddddddddddddddddddddddddddd')
  })

  it('places the null-pnl tiny room last', () => {
    const ranked = rankCreators(creators)
    expect(ranked[ranked.length - 1]?.creatorAddress).toBe(
      '0xcccccccccccccccccccccccccccccccccccccccc',
    )
  })

  it('breaks ties by totalSupply then tokenId then address', () => {
    const ranked = rankCreators([
      creator({ addr: '0x2222222222222222222222222222222222222222', tokenId: 2n, supply: 100n, staked: 50n, pnl: 0 }),
      creator({ addr: '0x1111111111111111111111111111111111111111', tokenId: 1n, supply: 100n, staked: 50n, pnl: 0 }),
      creator({ addr: '0x0000000000000000000000000000000000000099', tokenId: 3n, supply: 200n, staked: 100n, pnl: 0 }),
    ])
    // Higher supply ranks 1st.
    expect(ranked[0]?.tokenId).toBe(3n)
    // Tie on supply → lower tokenId first.
    expect(ranked[1]?.tokenId).toBe(1n)
    expect(ranked[2]?.tokenId).toBe(2n)
  })

  it('is deterministic across calls with the same input', () => {
    const a = rankCreators(creators).map((r) => [r.rank, r.creatorAddress, r.compositeScore] as const)
    const b = rankCreators(creators).map((r) => [r.rank, r.creatorAddress, r.compositeScore] as const)
    expect(a).toEqual(b)
  })

  it('lowercases every creatorAddress in the output', () => {
    const ranked = rankCreators([
      creator({ addr: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333', tokenId: 1n, supply: 1n, staked: 0n, pnl: null }),
    ])
    expect(ranked[0]?.creatorAddress).toBe('0xaaaabbbbccccddddeeeeffff0000111122223333')
  })
})
