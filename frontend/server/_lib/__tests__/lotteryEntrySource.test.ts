import { describe, expect, it, vi } from 'vitest'

import {
  classifyEntryFromAmoeStore,
  classifyEntryFromTransaction,
  enrichLotteryEntrySources,
} from '../lottery/lotteryEntrySource.js'

const AMOE_ROUTER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const LOTTERY_MANAGER = '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1'
const TX_HASH_A = '0xef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01ef01'
const TX_HASH_B = '0x9999999999999999999999999999999999999999999999999999999999999999'

describe('lotteryEntrySource', () => {
  it('marks AMOE when tx hash matches amoe_zk_submissions', () => {
    const matches = {
      txHashes: new Set([TX_HASH_A]),
      requestIds: new Set<string>(),
    }
    expect(
      classifyEntryFromAmoeStore(
        { transactionHash: TX_HASH_A, requestId: '1' },
        matches,
      ),
    ).toBe('amoe')
  })

  it('marks AMOE when request id matches manager_entry_id', () => {
    const matches = {
      txHashes: new Set<string>(),
      requestIds: new Set(['99']),
    }
    expect(
      classifyEntryFromAmoeStore(
        { transactionHash: '0x1111', requestId: '99' },
        matches,
      ),
    ).toBe('amoe')
  })

  it('classifies router-targeted txs as AMOE', async () => {
    process.env.LOTTERY_AMOE_ROUTER = AMOE_ROUTER
    const source = await classifyEntryFromTransaction(
      { transactionHash: TX_HASH_A, requestId: '1' },
      {
        lotteryManager: LOTTERY_MANAGER,
        amoeCallers: new Set([AMOE_ROUTER]),
        getTransaction: vi.fn(async () => ({
          from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          to: AMOE_ROUTER,
          input: '0x',
        })),
      },
    )
    expect(source).toBe('amoe')
    delete process.env.LOTTERY_AMOE_ROUTER
  })

  it('classifies unmatched txs as swap', async () => {
    const source = await classifyEntryFromTransaction(
      { transactionHash: TX_HASH_A, requestId: '1' },
      {
        lotteryManager: LOTTERY_MANAGER,
        amoeCallers: new Set([AMOE_ROUTER]),
        getTransaction: vi.fn(async () => ({
          from: '0xcccccccccccccccccccccccccccccccccccccccc',
          to: '0xdddddddddddddddddddddddddddddddddddddddd',
          input: '0x1234',
        })),
      },
    )
    expect(source).toBe('swap')
  })

  it('joins amoe store matches before defaulting to swap', async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [{ tx_hash: TX_HASH_A, manager_entry_id: '99' }],
      })),
    }

    const enriched = await enrichLotteryEntrySources(
      db as any,
      [
        {
          transactionHash: TX_HASH_A,
          requestId: '99',
        },
        {
          transactionHash: TX_HASH_B,
          requestId: '100',
        },
      ],
      { lotteryManager: LOTTERY_MANAGER },
    )

    expect(enriched[0]?.entrySource).toBe('amoe')
    expect(enriched[1]?.entrySource).toBe('swap')
  })
})
