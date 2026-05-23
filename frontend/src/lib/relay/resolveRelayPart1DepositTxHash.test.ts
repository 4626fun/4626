import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUserOperationReceipt = vi.fn()

vi.mock('viem/account-abstraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/account-abstraction')>()
  return {
    ...actual,
    createBundlerClient: vi.fn(() => ({
      getUserOperationReceipt: mockGetUserOperationReceipt,
    })),
  }
})

import {
  assertRelayPart1LandedSelfFunded,
  ensureRelayIndexablePart1TxHash,
  ENTRY_POINT_USER_OPERATION_EVENT_TOPIC,
  readPaymasterFromBundleReceipt,
  resolveBundleTxFromUserOperationHash,
  resolveRelayPart1DepositTxHash,
} from '@/lib/relay/resolveRelayPart1DepositTxHash'
import { verifyRelayPart1DepositTxHint } from '@/lib/relay/relayPart1DepositLookup'

vi.mock('@/lib/relay/relayPart1DepositLookup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/relay/relayPart1DepositLookup')>()
  return {
    ...actual,
    verifyRelayPart1DepositTxHint: vi.fn(),
  }
})

const BUNDLE_TX = ('0x' + '3a'.repeat(32)) as `0x${string}`
const USER_OP_TX = ('0x' + 'ec'.repeat(32)) as `0x${string}`

describe('resolveRelayPart1DepositTxHash', () => {
  beforeEach(() => {
    mockGetUserOperationReceipt.mockReset()
    vi.mocked(verifyRelayPart1DepositTxHint).mockReset()
  })

  it('returns bundle transactionHash when wallet_getCallsStatus includes it', async () => {
    const txHash = await resolveRelayPart1DepositTxHash({
      resolution: { transactionHash: BUNDLE_TX, userOperationHash: USER_OP_TX },
    })
    expect(txHash).toBe(BUNDLE_TX)
    expect(mockGetUserOperationReceipt).not.toHaveBeenCalled()
  })

  it('resolves bundle tx from UserOp hash when transactionHash is missing', async () => {
    mockGetUserOperationReceipt.mockResolvedValue({
      receipt: { transactionHash: BUNDLE_TX },
    })

    const txHash = await resolveRelayPart1DepositTxHash({
      resolution: { transactionHash: null, userOperationHash: USER_OP_TX },
      appendEvent: vi.fn(),
    })

    expect(txHash).toBe(BUNDLE_TX)
    expect(mockGetUserOperationReceipt).toHaveBeenCalledWith({ hash: USER_OP_TX })
  })

  it('throws when only UserOp hash is present and bundler cannot resolve bundle tx', async () => {
    mockGetUserOperationReceipt.mockResolvedValue(null)

    await expect(
      resolveRelayPart1DepositTxHash({
        resolution: { transactionHash: null, userOperationHash: USER_OP_TX },
      }),
    ).rejects.toThrow(/bundle transaction hash/)
  })
})

describe('ensureRelayIndexablePart1TxHash', () => {
  beforeEach(() => {
    mockGetUserOperationReceipt.mockReset()
    vi.mocked(verifyRelayPart1DepositTxHint).mockReset()
  })

  it('returns deposit hash when receipt already contains the depository log', async () => {
    vi.mocked(verifyRelayPart1DepositTxHint).mockResolvedValue(true)

    const txHash = await ensureRelayIndexablePart1TxHash({
      depositTxHash: BUNDLE_TX,
      publicClient: {} as never,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      orderId: '0x' + '4b'.repeat(32),
    })

    expect(txHash).toBe(BUNDLE_TX)
    expect(mockGetUserOperationReceipt).not.toHaveBeenCalled()
  })

  it('upgrades UserOp hash to bundle tx when receipt lookup fails', async () => {
    vi.mocked(verifyRelayPart1DepositTxHint)
      .mockRejectedValueOnce(new Error('Transaction receipt not found'))
      .mockResolvedValueOnce(true)
    mockGetUserOperationReceipt.mockResolvedValue({
      receipt: { transactionHash: BUNDLE_TX },
    })

    const txHash = await ensureRelayIndexablePart1TxHash({
      depositTxHash: USER_OP_TX,
      publicClient: {} as never,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      orderId: '0x' + '4b'.repeat(32),
    })

    expect(txHash).toBe(BUNDLE_TX)
  })
})

describe('resolveBundleTxFromUserOperationHash', () => {
  beforeEach(() => {
    mockGetUserOperationReceipt.mockReset()
  })

  it('returns null when bundler has no receipt yet', async () => {
    mockGetUserOperationReceipt.mockResolvedValue(null)
    await expect(
      resolveBundleTxFromUserOperationHash({ userOperationHash: USER_OP_TX }),
    ).resolves.toBeNull()
  })
})

describe('readPaymasterFromBundleReceipt', () => {
  it('reads paymaster from EntryPoint UserOperationEvent topic3', async () => {
    const publicClient = {
      getTransactionReceipt: vi.fn(async () => ({
        logs: [
          {
            address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
            topics: [
              ENTRY_POINT_USER_OPERATION_EVENT_TOPIC,
              '0x091ac8aa61097db4db3cb7de29531d49ae836004729fe9640dc3d2c58df1b53a',
              '0x0000000000000000000000004beabd0afbcc2f0440cdef1c3c745d43fae704ef',
              '0x0000000000000000000000002faeb0760d4230ef2ac21496bb4f0b47d634fd4c',
            ],
          },
        ],
      })),
    }

    const paymaster = await readPaymasterFromBundleReceipt({
      publicClient: publicClient as never,
      transactionHash: BUNDLE_TX,
      sender: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
    })

    expect(paymaster).toBe('0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c')
  })
})

describe('assertRelayPart1LandedSelfFunded', () => {
  beforeEach(() => {
    mockGetUserOperationReceipt.mockReset()
  })

  it('rejects when only bundle tx hash is present and receipt shows a paymaster', async () => {
    mockGetUserOperationReceipt.mockResolvedValue(null)
    const publicClient = {
      getTransactionReceipt: vi.fn(async () => ({
        logs: [
          {
            address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
            topics: [
              ENTRY_POINT_USER_OPERATION_EVENT_TOPIC,
              '0x091ac8aa61097db4db3cb7de29531d49ae836004729fe9640dc3d2c58df1b53a',
              '0x0000000000000000000000004beabd0afbcc2f0440cdef1c3c745d43fae704ef',
              '0x0000000000000000000000002faeb0760d4230ef2ac21496bb4f0b47d634fd4c',
            ],
          },
        ],
      })),
    }
    const appendEvent = vi.fn()

    await expect(
      assertRelayPart1LandedSelfFunded({
        resolution: { transactionHash: BUNDLE_TX, userOperationHash: null },
        publicClient: publicClient as never,
        fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
        appendEvent,
      }),
    ).rejects.toThrow(/USDC paymaster/)

    expect(appendEvent).toHaveBeenCalledWith(
      'relay_part1:landed_bundle_paymaster=0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c',
    )
  })
})
