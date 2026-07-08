import { describe, expect, it, vi } from 'vitest'

import {
  LOTTERY_INDEX_START_BLOCK,
  shouldServeLotteryFromIndex,
  resolveRecentWinners,
  fetchRecentWinnersFromIndex,
  type RecentWinnerEvent,
} from '../../server/_lib/lottery/recentWinnersQuery.js'

const rpcFixture: RecentWinnerEvent[] = [
  {
    type: 'LotteryWinner',
    blockNumber: '1',
    transactionHash: '0xabc',
    logIndex: 0,
    creatorCoin: '0x1',
    user: '0x2',
    swapAmountUsd1e6: '0',
    rewardAmount: '0',
    requestId: '0',
  },
]

const rpcMock = vi.fn(async () => rpcFixture)

describe('shouldServeLotteryFromIndex', () => {
  it('uses index when tip covers the requested window after greenfield start', () => {
    const from = LOTTERY_INDEX_START_BLOCK
    const to = LOTTERY_INDEX_START_BLOCK + 10_000n
    const tip = to
    expect(shouldServeLotteryFromIndex(from, to, tip)).toBe(true)
  })

  it('falls back when lookback starts before the shovel start block', () => {
    expect(
      shouldServeLotteryFromIndex(LOTTERY_INDEX_START_BLOCK - 1n, LOTTERY_INDEX_START_BLOCK + 100n, 999999999n),
    ).toBe(false)
  })

  it('falls back when index tip lags toBlock beyond slack', () => {
    const to = 1000n
    expect(shouldServeLotteryFromIndex(LOTTERY_INDEX_START_BLOCK, to, 100n)).toBe(false)
  })
})

describe('resolveRecentWinners', () => {
  it('returns indexed rows without RPC when index covers the window', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [{ tip: '48360000' }] })),
      query: vi.fn(async () => ({
        rows: [
          {
            block_num: '48350000',
            tx_hash: Buffer.from('abcd', 'hex'),
            log_idx: 3,
            event_type: 'LotteryWinner',
            creator_coin: '0xcccccccccccccccccccccccccccccccccccccccc',
            winner_user: '0xdddddddddddddddddddddddddddddddddddddddd',
            swap_amount_usd: '100',
            reward_amount: '200',
            request_id: '7',
          },
        ],
      })),
    }

    const result = await resolveRecentWinners(db as any, {
      lotteryManager: '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1',
      creatorCoin: null,
      fromBlock: LOTTERY_INDEX_START_BLOCK,
      toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
      limit: 25,
    })

    expect(result.dataSource).toBe('index')
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.type).toBe('LotteryWinner')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('falls back to RPC when index tip is unavailable', async () => {
    rpcMock.mockClear()
    const db = {
      sql: vi.fn(async () => ({ rows: [{ tip: '0' }] })),
      query: vi.fn(),
    }

    const result = await resolveRecentWinners(
      db as any,
      {
        lotteryManager: '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1',
        creatorCoin: null,
        fromBlock: LOTTERY_INDEX_START_BLOCK,
        toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
        limit: 25,
      },
      { fetchFromRpc: rpcMock },
    )

    expect(result.dataSource).toBe('rpc')
    expect(rpcMock).toHaveBeenCalledOnce()
  })

  it('falls back to RPC when db is unavailable', async () => {
    rpcMock.mockClear()

    const result = await resolveRecentWinners(
      null,
      {
        lotteryManager: '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1',
        creatorCoin: null,
        fromBlock: 0n,
        toBlock: 1000n,
        limit: 25,
      },
      { fetchFromRpc: rpcMock },
    )

    expect(result.dataSource).toBe('rpc')
    expect(rpcMock).toHaveBeenCalledOnce()
  })
})

describe('fetchRecentWinnersFromIndex', () => {
  it('maps multi-jackpot rows into the public API shape', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            block_num: '48350001',
            tx_hash: Buffer.from('ef01', 'hex'),
            log_idx: 1,
            event_type: 'MultiTokenJackpotWon',
            creator_coin: null,
            winner_user: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            swap_amount_usd: null,
            reward_amount: null,
            request_id: null,
            triggering_coin: '0xffffffffffffffffffffffffffffffffffffffff',
            num_vaults_paid: '4',
          },
        ],
      })),
    }

    const events = await fetchRecentWinnersFromIndex(db as any, {
      lotteryManager: '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1',
      creatorCoin: null,
      fromBlock: LOTTERY_INDEX_START_BLOCK,
      toBlock: LOTTERY_INDEX_START_BLOCK + 1000n,
      limit: 10,
    })

    expect(events[0]).toEqual({
      type: 'MultiTokenJackpotWon',
      blockNumber: '48350001',
      transactionHash: '0xef01',
      logIndex: 1,
      triggeringCoin: '0xffffffffffffffffffffffffffffffffffffffff',
      winner: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      numVaultsPaid: '4',
    })
  })
})
