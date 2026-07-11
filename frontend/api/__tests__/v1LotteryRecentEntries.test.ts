import { describe, expect, it, vi } from 'vitest'

import {
  LOTTERY_INDEX_START_BLOCK,
  shouldServeLotteryFromIndex,
} from '../../server/_lib/lottery/recentWinnersQuery.js'
import {
  fetchRecentEntriesFromIndex,
  resolveRecentEntries,
  type RecentLotteryEntryEvent,
} from '../../server/_lib/lottery/recentEntriesQuery.js'
import { enrichLotteryEntrySources } from '../../server/_lib/lottery/lotteryEntrySource.js'

const AMOE_ROUTER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const LOTTERY_MANAGER = '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1'

const rpcFixture: Omit<RecentLotteryEntryEvent, 'entrySource'>[] = [
  {
    type: 'LotteryEntryCreated',
    blockNumber: '1',
    transactionHash: '0xabc',
    logIndex: 0,
    creatorCoin: '0x1',
    user: '0x2',
    swapAmountUsd1e6: '100',
    winChancePpm: '5000',
    requestId: '42',
  },
]

const enrichMock = vi.fn<typeof enrichLotteryEntrySources>()
enrichMock.mockImplementation(async (_db, events) =>
  events.map((event) => ({ ...event, entrySource: 'swap' as const })),
)

const rpcMock = vi.fn(async () => rpcFixture)

describe('resolveRecentEntries', () => {
  it('returns indexed rows without RPC when index covers the window', async () => {
    enrichMock.mockClear()
    rpcMock.mockClear()
    const db = {
      sql: vi.fn(async () => ({ rows: [{ tip: '48360000' }] })),
      query: vi.fn(async () => ({
        rows: [
          {
            block_num: '48350000',
            tx_hash: Buffer.from('abcd', 'hex'),
            log_idx: 3,
            creator_coin: '0xcccccccccccccccccccccccccccccccccccccccc',
            entry_user: '0xdddddddddddddddddddddddddddddddddddddddd',
            swap_amount_usd: '100',
            win_chance_ppm: '5000',
            request_id: '7',
          },
        ],
      })),
    }

    enrichMock.mockImplementationOnce(async (_db, events) =>
      events.map((event) => ({ ...event, entrySource: 'amoe' as const })),
    )

    const result = await resolveRecentEntries(
      db as any,
      {
        lotteryManager: LOTTERY_MANAGER,
        creatorCoin: null,
        fromBlock: LOTTERY_INDEX_START_BLOCK,
        toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
        limit: 25,
      },
      { enrichSources: enrichMock as typeof enrichLotteryEntrySources, getTransaction: vi.fn() },
    )

    expect(result.dataSource).toBe('index')
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.entrySource).toBe('amoe')
    expect(rpcMock).not.toHaveBeenCalled()
    expect(enrichMock).toHaveBeenCalledOnce()
  })

  it('falls back to RPC when index tip is unavailable', async () => {
    rpcMock.mockClear()
    enrichMock.mockClear()
    const db = {
      sql: vi.fn(async () => ({ rows: [{ tip: '0' }] })),
      query: vi.fn(),
    }

    const result = await resolveRecentEntries(
      db as any,
      {
        lotteryManager: LOTTERY_MANAGER,
        creatorCoin: null,
        fromBlock: LOTTERY_INDEX_START_BLOCK,
        toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
        limit: 25,
      },
      {
        fetchFromRpc: rpcMock,
        enrichSources: enrichMock as typeof enrichLotteryEntrySources,
        getTransaction: vi.fn(),
      },
    )

    expect(result.dataSource).toBe('rpc')
    expect(rpcMock).toHaveBeenCalledOnce()
    expect(enrichMock).toHaveBeenCalledOnce()
  })

  it('falls back to RPC when db is unavailable', async () => {
    rpcMock.mockClear()
    enrichMock.mockClear()

    const result = await resolveRecentEntries(
      null,
      {
        lotteryManager: LOTTERY_MANAGER,
        creatorCoin: null,
        fromBlock: 0n,
        toBlock: 1000n,
        limit: 25,
      },
      {
        fetchFromRpc: rpcMock,
        enrichSources: enrichMock as typeof enrichLotteryEntrySources,
        getTransaction: vi.fn(),
      },
    )

    expect(result.dataSource).toBe('rpc')
    expect(rpcMock).toHaveBeenCalledOnce()
    expect(enrichMock).toHaveBeenCalledOnce()
  })
})

describe('fetchRecentEntriesFromIndex', () => {
  it('maps entry rows into the public API shape', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            block_num: '48350001',
            tx_hash: Buffer.from('ef01', 'hex'),
            log_idx: 1,
            creator_coin: '0xffffffffffffffffffffffffffffffffffffffff',
            entry_user: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            swap_amount_usd: '2500000',
            win_chance_ppm: '12000',
            request_id: '99',
          },
        ],
      })),
    }

    const events = await fetchRecentEntriesFromIndex(db as any, {
      lotteryManager: LOTTERY_MANAGER,
      creatorCoin: null,
      fromBlock: LOTTERY_INDEX_START_BLOCK,
      toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
      limit: 10,
    })

    expect(events[0]).toEqual({
      type: 'LotteryEntryCreated',
      blockNumber: '48350001',
      transactionHash: '0xef01',
      logIndex: 1,
      creatorCoin: '0xffffffffffffffffffffffffffffffffffffffff',
      user: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      swapAmountUsd1e6: '2500000',
      winChancePpm: '12000',
      requestId: '99',
    })
  })
})

describe('shouldServeLotteryFromIndex (entries)', () => {
  it('uses index when tip covers the requested window after greenfield start', () => {
    const from = LOTTERY_INDEX_START_BLOCK
    const to = LOTTERY_INDEX_START_BLOCK + 10_000n
    const tip = to
    expect(shouldServeLotteryFromIndex(from, to, tip)).toBe(true)
  })
})
