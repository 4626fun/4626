import { describe, expect, it } from 'vitest'

import type { AlfaClubCreator } from './creators.js'
import type { MetricsSnapshotRow } from './publicationLedger.js'
import { mergeCreatorMetricsForSnapshot, selectRotatingScoringBatch } from './vigilante.js'

function creator(tokenId: number, address: string): AlfaClubCreator {
  return {
    tokenId: BigInt(tokenId),
    creatorAddress: address as `0x${string}`,
    mintedAtBlock: 100n,
    stakingPool: null,
  }
}

function snapshotRow(address: string, tokenId: number): MetricsSnapshotRow {
  return {
    snapshotTs: '2026-07-01T12:00:00Z',
    creatorAddress: address as `0x${string}`,
    tokenId: BigInt(tokenId),
    totalSupply: 50n,
    stakedSupply: 30n,
    pnl30dUsd: 100,
    hlAccountValueUsd: 5000,
    score: 0.12,
    rank: 1,
  }
}

describe('selectRotatingScoringBatch', () => {
  const creators = [
    creator(1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    creator(2, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    creator(3, '0xcccccccccccccccccccccccccccccccccccccccc'),
    creator(4, '0xdddddddddddddddddddddddddddddddddddddddd'),
  ]

  it('returns an empty batch when there are no creators', () => {
    expect(selectRotatingScoringBatch([], 0, 2)).toEqual({ batch: [], nextOffset: 0 })
  })

  it('rotates through all creators without skipping', () => {
    const first = selectRotatingScoringBatch(creators, 0, 2)
    expect(first.batch.map((entry) => Number(entry.tokenId))).toEqual([1, 2])
    expect(first.nextOffset).toBe(2)

    const second = selectRotatingScoringBatch(creators, first.nextOffset, 2)
    expect(second.batch.map((entry) => Number(entry.tokenId))).toEqual([3, 4])
    expect(second.nextOffset).toBe(0)

    const third = selectRotatingScoringBatch(creators, second.nextOffset, 2)
    expect(third.batch.map((entry) => Number(entry.tokenId))).toEqual([1, 2])
  })

  it('wraps a mid-list offset correctly', () => {
    const wrapped = selectRotatingScoringBatch(creators, 3, 2)
    expect(wrapped.batch.map((entry) => Number(entry.tokenId))).toEqual([4, 1])
    expect(wrapped.nextOffset).toBe(1)
  })
})

describe('mergeCreatorMetricsForSnapshot', () => {
  const creators = [
    creator(1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    creator(2, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    creator(3, '0xcccccccccccccccccccccccccccccccccccccccc'),
  ]

  it('prefers fresh batch metrics over cached rows', () => {
    const batchMetrics = [
      {
        tokenId: 1n,
        creatorAddress: creators[0]!.creatorAddress,
        totalSupply: 10n,
        stakedSupply: 8n,
        hyperliquid: { accountValueUsd: 900, pnl30dUsd: 50 },
      },
    ]
    const cached = new Map([
      [
        creators[0]!.creatorAddress.toLowerCase(),
        snapshotRow(creators[0]!.creatorAddress, 1),
      ],
    ])

    const merged = mergeCreatorMetricsForSnapshot({
      allCreators: creators,
      batchMetrics,
      cachedByCreator: cached,
      lightMetrics: [],
    })

    expect(merged[0]?.totalSupply).toBe(10n)
    expect(merged[0]?.hyperliquid?.accountValueUsd).toBe(900)
  })

  it('falls back to cached metrics when a creator is outside the batch', () => {
    const cached = new Map([
      [
        creators[1]!.creatorAddress.toLowerCase(),
        snapshotRow(creators[1]!.creatorAddress, 2),
      ],
    ])

    const merged = mergeCreatorMetricsForSnapshot({
      allCreators: creators,
      batchMetrics: [],
      cachedByCreator: cached,
      lightMetrics: [],
    })

    expect(merged[1]?.totalSupply).toBe(50n)
    expect(merged[1]?.hyperliquid?.accountValueUsd).toBe(5000)
  })

  it('uses light metrics for creators with no cache', () => {
    const merged = mergeCreatorMetricsForSnapshot({
      allCreators: creators,
      batchMetrics: [],
      cachedByCreator: new Map(),
      lightMetrics: [
        {
          tokenId: 3n,
          creatorAddress: creators[2]!.creatorAddress,
          totalSupply: 7n,
          stakedSupply: 4n,
          hyperliquid: null,
        },
      ],
    })

    expect(merged[2]?.totalSupply).toBe(7n)
    expect(merged[2]?.hyperliquid).toBeNull()
  })
})
