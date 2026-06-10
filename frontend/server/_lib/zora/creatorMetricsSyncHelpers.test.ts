import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HOT_REFRESH_LISTS,
  computeFees24hUsd,
  createDefaultExploreBackfillCheckpoints,
  detectFeeModel,
  extractExploreListEdges,
  isExploreBackfillComplete,
  isStaleRunningLock,
  parseExploreBackfillCheckpoints,
  parseExploreCoinFinancialSnapshot,
  serializeExploreBackfillCheckpoints,
} from './creatorMetricsSyncHelpers.js'

describe('creatorMetricsSyncHelpers', () => {
  it('parses explore list financial snapshots from Zora nodes', () => {
    const snapshot = parseExploreCoinFinancialSnapshot({
      address: '0x00000000000000000000000000000000000000aa',
      creatorAddress: '0x00000000000000000000000000000000000000bb',
      createdAt: '2025-07-01T00:00:00.000Z',
      marketCap: '125000.5',
      volume24h: '494592.77',
      uniqueHolders: 321,
      marketCapDelta24h: '4.2',
      market: { feeBps: 100, protocolVersion: 'v4' },
    })

    expect(snapshot).toMatchObject({
      coinAddress: '0x00000000000000000000000000000000000000aa',
      creatorAddress: '0x00000000000000000000000000000000000000bb',
      marketCapUsd: 125000.5,
      volume24hUsd: 494592.77,
      fees24hUsd: 4945.9277,
      uniqueHolders: 321,
      marketCapDelta24h: 4.2,
      feeModel: 'v4',
    })
  })

  it('extracts pagination metadata from explore list responses', () => {
    const parsed = extractExploreListEdges({
      data: {
        exploreList: {
          edges: [{ node: { address: '0x1' } }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
        },
      },
    })

    expect(parsed.edges).toHaveLength(1)
    expect(parsed.pageInfo).toEqual({ hasNextPage: true, endCursor: 'cursor-2' })
  })

  it('treats long-running sync locks as stale', () => {
    const now = Date.parse('2026-05-22T12:00:00.000Z')
    expect(isStaleRunningLock('2026-05-22T11:45:00.000Z', now, 20 * 60 * 1000)).toBe(false)
    expect(isStaleRunningLock('2026-05-22T11:30:00.000Z', now, 20 * 60 * 1000)).toBe(true)
    expect(isStaleRunningLock(null, now, 20 * 60 * 1000)).toBe(true)
  })

  it('defaults hot refresh lists to volume, mcap, and new creators', () => {
    expect(DEFAULT_HOT_REFRESH_LISTS).toEqual([
      'TOP_VOLUME_CREATORS_24H',
      'MOST_VALUABLE_CREATORS',
      'NEW_CREATORS',
    ])
  })

  it('detects legacy fee model from market metadata', () => {
    expect(
      detectFeeModel({
        createdAt: '2025-07-01T00:00:00.000Z',
        market: { feeBps: 300 },
      }),
    ).toBe('legacy')
    expect(computeFees24hUsd(1000, 'legacy')).toBe(30)
  })

  it('round-trips explore backfill checkpoints', () => {
    const checkpoints = createDefaultExploreBackfillCheckpoints()
    checkpoints.NEW_CREATORS = { after: 'cursor-1', complete: false }
    checkpoints.MOST_VALUABLE_CREATORS.complete = true
    const serialized = serializeExploreBackfillCheckpoints(checkpoints)
    const parsed = parseExploreBackfillCheckpoints(serialized)
    expect(parsed.NEW_CREATORS).toEqual({ after: 'cursor-1', complete: false })
    expect(parsed.MOST_VALUABLE_CREATORS.complete).toBe(true)
    expect(isExploreBackfillComplete(parsed)).toBe(false)
    parsed.TOP_VOLUME_CREATORS_24H.complete = true
    parsed.NEW_CREATORS.complete = true
    expect(isExploreBackfillComplete(parsed)).toBe(true)
  })
})
