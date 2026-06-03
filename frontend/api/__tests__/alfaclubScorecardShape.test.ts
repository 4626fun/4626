import { describe, expect, it } from 'vitest'

import {
  SCORECARD_DISCLAIMER,
  SCORECARD_SCHEMA,
  buildScorecard,
  formatScorecardPostBody,
} from '../../server/_lib/alfaclub/scorecard.ts'
import type { RankedCreator } from '../../server/_lib/alfaclub/leaderboard.ts'
import { CANONICAL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.ts'

function makeRanked(): RankedCreator {
  return {
    rank: 5,
    tokenId: 42n,
    creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    totalSupply: 1234n,
    stakedSupply: 980n,
    hyperliquid: {
      accountValueUsd: 45_221,
      pnl30dUsd: 185_000,
    },
    popularityScore: 0.6213,
    performanceScore: 0.185,
    compositeScore: 0.3595,
  }
}

describe('scorecard — buildScorecard', () => {
  const built = buildScorecard({
    creator: makeRanked(),
    snapshotTs: '2026-04-20T12:00:00Z',
    totalCreatorsRanked: 312,
    sources: {
      friendKeyContract: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
      friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9',
      friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d',
      hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
    },
  })

  it('stamps the versioned schema identifier', () => {
    expect(built.scorecard.schema).toBe(SCORECARD_SCHEMA)
  })

  it('embeds the disclaimer verbatim', () => {
    expect(built.scorecard.disclaimer).toBe(SCORECARD_DISCLAIMER)
  })

  it('stringifies bigint metrics as decimal strings', () => {
    expect(built.scorecard.metrics.totalSupply).toBe('1234')
    expect(built.scorecard.metrics.stakedSupply).toBe('980')
    expect(built.scorecard.creator.tokenId).toBe('42')
  })

  it('rounds float scores to 4 decimals', () => {
    expect(built.scorecard.scores.popularity).toBeCloseTo(0.6213, 6)
    expect(built.scorecard.scores.performance).toBeCloseTo(0.185, 6)
    expect(built.scorecard.scores.composite).toBeCloseTo(0.3595, 6)
  })

  it('uses the snapshotTs passed in', () => {
    expect(built.scorecard.snapshotTs).toBe('2026-04-20T12:00:00Z')
  })

  it('records the publisher identity as the canonical Keepr CSW + registry', () => {
    expect(built.scorecard.publisher.agentId).toBe(2205)
    expect(built.scorecard.publisher.canonicalCsw).toBe(CANONICAL_CSW_ADDRESS)
    expect(built.scorecard.publisher.agentRegistry.startsWith('eip155:8453:')).toBe(true)
  })

  it('canonicalJson is deterministic JSON.stringify of the scorecard', () => {
    expect(built.canonicalJson).toBe(JSON.stringify(built.scorecard))
  })

  it('hash is a 0x-prefixed 32-byte keccak', () => {
    expect(built.hash).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('lowercases the creator address for the final scorecard', () => {
    const upper = buildScorecard({
      creator: {
        ...makeRanked(),
        creatorAddress: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333' as `0x${string}`,
      },
      snapshotTs: '2026-04-20T12:00:00Z',
      totalCreatorsRanked: 1,
      sources: {
        friendKeyContract: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
        friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9',
        friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d',
        hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
      },
    })
    expect(upper.scorecard.creator.address).toBe('0xaaaabbbbccccddddeeeeffff0000111122223333')
  })
})

describe('scorecard — formatScorecardPostBody', () => {
  const built = buildScorecard({
    creator: makeRanked(),
    snapshotTs: '2026-04-20T12:00:00Z',
    totalCreatorsRanked: 312,
    sources: {
      friendKeyContract: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
      friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9',
      friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d',
      hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
    },
  })

  it('includes the snapshot timestamp and creator address', () => {
    const body = formatScorecardPostBody(built.scorecard, 'lens://grove/cid')
    expect(body).toContain('2026-04-20T12:00:00Z')
    expect(body).toContain('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(body).toContain('lens://grove/cid')
    expect(body).toContain(SCORECARD_DISCLAIMER)
  })

  it('reports supply + rank', () => {
    const body = formatScorecardPostBody(built.scorecard, 'lens://grove/cid')
    expect(body).toContain('supply=1234')
    expect(body).toContain('staked=980')
    expect(body).toContain('rank 5/312')
  })
})
