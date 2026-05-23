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
  ensureRelayIndexablePart1TxHash,
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
