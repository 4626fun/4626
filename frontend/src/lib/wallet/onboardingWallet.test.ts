import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, sendCoinbaseSmartWalletUserOperationMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  sendCoinbaseSmartWalletUserOperationMock: vi.fn(),
}))

vi.mock('@/lib/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@/lib/aa/coinbaseErc4337', () => ({
  sendCoinbaseSmartWalletUserOperation: sendCoinbaseSmartWalletUserOperationMock,
}))

import { sendPreparedOwnerTx } from './onboardingWallet'

const CANONICAL_CSW = '0x1111111111111111111111111111111111111111' as const
const OWNER_EOA = '0x2222222222222222222222222222222222222222' as const
const TX_HASH = `0x${'a'.repeat(64)}` as const
const TX_REQUEST = {
  chainId: 8453 as const,
  to: CANONICAL_CSW,
  data: '0x0f0f3f240000000000000000000000002222222222222222222222222222222222222222' as const,
  value: '0x0' as const,
}

function makeJsonResponse<T>(payload: T, ok = true) {
  return {
    ok,
    json: vi.fn(async () => payload),
  }
}

describe('sendPreparedOwnerTx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockResolvedValue(
      makeJsonResponse({
        success: true,
        data: {
          isOwner: true,
          canonicalCswAddress: CANONICAL_CSW,
          ownerAddress: OWNER_EOA,
          txHash: TX_HASH,
        },
      }),
    )
    sendCoinbaseSmartWalletUserOperationMock.mockResolvedValue({ transactionHash: TX_HASH })
  })

  it('uses direct sendTransaction for external owner execution', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: OWNER_EOA,
        sendTransaction,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      signerAddress: OWNER_EOA,
      executionMode: 'ownerDirect',
    })

    expect(sendTransaction).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/wallet/confirm-owner',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(result.txHash).toBe(TX_HASH)
  })

  it('uses direct sendTransaction when canonical mode is self-authenticated by CSW session', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi
      .fn()
      .mockResolvedValueOnce('0xcall-bundle-id')
      .mockResolvedValueOnce({
        status: 200,
        receipts: [{ transactionHash: TX_HASH }],
      })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction,
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    expect(ensurePaymasterSession).not.toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'wallet_sendCalls',
      }),
    )
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('falls back to sendTransaction when wallet_sendCalls is unsupported for self-authenticated canonical sessions', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn(async () => {
      throw new Error('Method not found')
    })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction,
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    expect(ensurePaymasterSession).not.toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(sendTransaction).toHaveBeenCalledTimes(1)
    expect(result.txHash).toBe(TX_HASH)
  })

  it('routes canonical CSW approval through paymaster user-op when signer is an owner EOA', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: OWNER_EOA,
        sendTransaction,
        request: vi.fn(),
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: OWNER_EOA,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    expect(ensurePaymasterSession).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        smartWallet: CANONICAL_CSW,
        ownerAddress: OWNER_EOA,
      }),
    )
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('retries canonical user-op once when paymaster proxy returns an internal error', async () => {
    sendCoinbaseSmartWalletUserOperationMock
      .mockRejectedValueOnce(new Error('Paymaster rejected this request: paymaster proxy internal error'))
      .mockResolvedValueOnce({ transactionHash: TX_HASH })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: OWNER_EOA,
        sendTransaction: vi.fn(async () => TX_HASH),
        request: vi.fn(),
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: OWNER_EOA,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession: async () => true,
    })

    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(2)
    expect(result.txHash).toBe(TX_HASH)
  })

  it('does not fall back to native sendTransaction when paymaster session errors persist', async () => {
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('Paymaster rejected this request: paymaster proxy internal error'),
    )
    const sendTransaction = vi.fn(async () => TX_HASH)

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: OWNER_EOA,
          sendTransaction,
          request: vi.fn(),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession: async () => true,
      }),
    ).rejects.toThrow(
      '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
    )

    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(3)
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('retries owner confirmation when tx is submitted but owner state is not yet indexed', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    apiFetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: {
            isOwner: false,
            canonicalCswAddress: CANONICAL_CSW,
            ownerAddress: OWNER_EOA,
            txHash: TX_HASH,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: {
            isOwner: true,
            canonicalCswAddress: CANONICAL_CSW,
            ownerAddress: OWNER_EOA,
            txHash: TX_HASH,
          },
        }),
      )

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: OWNER_EOA,
        sendTransaction,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      signerAddress: OWNER_EOA,
      executionMode: 'ownerDirect',
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    expect(result.isOwner).toBe(true)
  })

  it('fails early when the paymaster session cannot be established for canonical execution', async () => {
    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: OWNER_EOA,
          sendTransaction: vi.fn(async () => TX_HASH),
          request: vi.fn(),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession: async () => false,
      }),
    ).rejects.toThrow('4626 could not start the smart-wallet sponsor session. Sign in again and retry.')

    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('normalizes misleading smart-wallet insufficient-funds errors', async () => {
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('Error generating transaction. Please make sure you have enough funds to complete the transaction.'),
    )

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: OWNER_EOA,
          sendTransaction: vi.fn(async () => TX_HASH),
          request: vi.fn(),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession: async () => true,
      }),
    ).rejects.toThrow(
      'Wallet could not generate the Coinbase Smart Wallet approval. Retry from the same Base/Zora smart wallet, and reconnect it if the sponsor session has gone stale.',
    )
  })

  it('normalizes paymaster proxy internal errors into a user-actionable message', async () => {
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('Paymaster rejected this request: paymaster proxy internal error (CDP: Request Arguments...)'),
    )

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: OWNER_EOA,
          sendTransaction: vi.fn(async () => TX_HASH),
          request: vi.fn(),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession: async () => true,
      }),
    ).rejects.toThrow(
      '4626 could not initialize Base gas sponsorship. Retry in a few seconds. If it persists, use Not you? Switch and reconnect the same Base wallet.',
    )
  })

  it('rejects canonical execution when the prepared target is not the canonical CSW', async () => {
    await expect(
      sendPreparedOwnerTx({
        txRequest: {
          ...TX_REQUEST,
          to: '0x3333333333333333333333333333333333333333',
        },
        walletClient: {
          account: CANONICAL_CSW,
          sendTransaction: vi.fn(async () => TX_HASH),
          request: vi.fn(),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: CANONICAL_CSW,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession: async () => true,
      }),
    ).rejects.toThrow('Prepared owner install target does not match the canonical Coinbase Smart Wallet.')

    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
  })
})
