import { describe, expect, it, vi } from 'vitest'
import { encodeEventTopics, getAddress, type Hex } from 'viem'

import {
  BASE_USDC_ADDRESS,
  USDC_TRANSFER_EVENT_ABI,
  resolveProtocolTreasuryForUsdcPayments,
  verifyUsdcPayment,
} from './usdcPayment'

// Checksummed test fixtures. encodeEventTopics rejects non-checksum
// addresses, so tests must use canonical forms here.
const CREATOR = getAddress('0x1111111111111111111111111111111111111111')
const TREASURY = getAddress('0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3')
const TX_HASH = ('0x' + 'bb'.repeat(32)) as Hex

function makeTransferLog(params: {
  address: string
  from: string
  to: string
  value: bigint
}) {
  const topics = encodeEventTopics({
    abi: USDC_TRANSFER_EVENT_ABI,
    eventName: 'Transfer',
    args: { from: params.from as `0x${string}`, to: params.to as `0x${string}` },
  })
  const data = ('0x' + params.value.toString(16).padStart(64, '0')) as Hex
  return {
    address: params.address as `0x${string}`,
    data,
    topics: topics as readonly Hex[],
  }
}

describe('verifyUsdcPayment', () => {
  it('returns ok when a Transfer log matches (from, to, >=minAmount)', async () => {
    const client = {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success' as const,
        blockNumber: 123n,
        logs: [
          makeTransferLog({
            address: BASE_USDC_ADDRESS,
            from: CREATOR,
            to: TREASURY,
            value: 100_000_000n,
          }),
        ],
      })),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.from).toBe(CREATOR)
      expect(result.to).toBe(TREASURY)
      expect(result.value).toBe(100_000_000n)
      expect(result.blockNumber).toBe(123n)
    }
  })

  it('returns transfer_not_found when value is below minAmount', async () => {
    const client = {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success' as const,
        blockNumber: 1n,
        logs: [
          makeTransferLog({
            address: BASE_USDC_ADDRESS,
            from: CREATOR,
            to: TREASURY,
            value: 99_999_999n,
          }),
        ],
      })),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('transfer_not_found')
  })

  it('returns transfer_not_found when recipient is not the treasury', async () => {
    const WRONG_DEST = getAddress('0x2222222222222222222222222222222222222222')
    const client = {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success' as const,
        blockNumber: 1n,
        logs: [
          makeTransferLog({
            address: BASE_USDC_ADDRESS,
            from: CREATOR,
            to: WRONG_DEST,
            value: 100_000_000n,
          }),
        ],
      })),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('transfer_not_found')
  })

  it('ignores Transfer logs from non-USDC contracts', async () => {
    const SPOOF_TOKEN = getAddress('0x3333333333333333333333333333333333333333')
    const client = {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success' as const,
        blockNumber: 1n,
        logs: [
          makeTransferLog({
            address: SPOOF_TOKEN,
            from: CREATOR,
            to: TREASURY,
            value: 100_000_000n,
          }),
        ],
      })),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('transfer_not_found')
  })

  it('returns tx_reverted when receipt.status is "reverted"', async () => {
    const client = {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'reverted' as const,
        blockNumber: 1n,
        logs: [],
      })),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('tx_reverted')
  })

  it('returns tx_not_found when receipt read throws "not found"', async () => {
    const client = {
      getTransactionReceipt: vi.fn(async () => {
        throw new Error('Transaction with hash ... could not be found.')
      }),
    }
    const result = await verifyUsdcPayment({
      txHash: TX_HASH,
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      publicClient: client,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('tx_not_found')
  })
})

describe('resolveProtocolTreasuryForUsdcPayments', () => {
  it('defaults to the canonical protocolTreasury Safe when env is unset', () => {
    const prior = process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY
    delete process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY
    try {
      expect(resolveProtocolTreasuryForUsdcPayments()).toBe(TREASURY)
    } finally {
      if (prior !== undefined) process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY = prior
    }
  })

  it('honors CREATOR_STRATEGY_FEATURE_USDC_TREASURY override', () => {
    const prior = process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY
    const override = '0x000000000000000000000000000000000000dEaD'
    process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY = override
    try {
      expect(resolveProtocolTreasuryForUsdcPayments().toLowerCase()).toBe(override.toLowerCase())
    } finally {
      if (prior === undefined) delete process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY
      else process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY = prior
    }
  })
})
