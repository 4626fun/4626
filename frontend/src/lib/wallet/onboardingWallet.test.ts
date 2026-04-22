import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, sendCoinbaseSmartWalletUserOperationMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  sendCoinbaseSmartWalletUserOperationMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
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
          confirmationState: 'owner_confirmed',
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

  it('routes custom co-owner installs through direct tx lane only for self-auth sessions', async () => {
    const request = vi.fn().mockRejectedValue(
      new Error('Error generating transaction. Please make sure you have enough funds to complete the transaction.'),
    )

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: CANONICAL_CSW,
          sendTransaction: vi.fn(async () => TX_HASH),
          request,
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        signerAddress: CANONICAL_CSW,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        ownerInstallIntent: 'customCoOwner',
        publicClient: {},
        ensurePaymasterSession: async () => true,
      }),
    ).rejects.toThrow('Direct co-owner approval needs ETH for gas on the signing wallet.')

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
  })

  it('routes custom co-owner installs through direct tx lane for owner-EOA canonical sessions', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)

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
      ownerInstallIntent: 'customCoOwner',
      publicClient: {},
      ensurePaymasterSession: async () => true,
    })

    expect(sendTransaction).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('routes custom co-owner installs through sponsored lane when policy token is provided', async () => {
    const request = vi.fn().mockResolvedValue(undefined)
    const ensurePaymasterSession = vi.fn(async () => true)

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction: vi.fn(async () => TX_HASH),
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      ownerIndexLookupAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      ownerInstallIntent: 'customCoOwner',
      customOwnerPolicyToken: 'custom-owner-policy-token',
      publicClient: {},
      ensurePaymasterSession,
    })

    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        useTypedDataSigning: false,
        ownerIndexOverride: 0,
        ownerIndexLookupAddress: undefined,
        ownerApprovalContext: expect.objectContaining({
          customOwnerPolicyToken: 'custom-owner-policy-token',
        }),
      }),
    )
    expect(result.txHash).toBe(TX_HASH)
  })

  it('self-auth tries eth_sendTransaction first, falls back to UserOp when request mock returns undefined', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn() // returns undefined for eth_sendTransaction → triggers fallback

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction,
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    // eth_sendTransaction was attempted first (primary path)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // Fell back to UserOp since eth_sendTransaction returned undefined
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    // No addSubAccount or wallet_sendCalls
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addSubAccount' }),
    )
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(result.isOwner).toBe(true)
  })

  it('self-auth falls back to UserOp when no ownerAddress is available and eth_sendTransaction fails', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn() // returns undefined for eth_sendTransaction → triggers fallback

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

    // eth_sendTransaction attempted first
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // Fell back to UserOp
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('self-auth falls back from eth_sendTransaction to typed UserOp to non-typed UserOp', async () => {
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn() // returns undefined for eth_sendTransaction → triggers fallback chain
    // First UserOp (typed) fails, second (non-typed) succeeds
    sendCoinbaseSmartWalletUserOperationMock
      .mockRejectedValueOnce(new Error('eth_signTypedData_v4 not supported'))
      .mockResolvedValueOnce({ transactionHash: TX_HASH })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction: vi.fn(async () => TX_HASH),
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      ownerIndexLookupAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    // eth_sendTransaction attempted first
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // UserOp tried twice (typed then non-typed)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(2)
    // Second call should have disableTypedDataSigning: true
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ useTypedDataSigning: false }),
    )
    // No addSubAccount or sendCalls attempted
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addSubAccount' }),
    )
    expect(result.txHash).toBe(TX_HASH)
  })

  it('does not fall back further when user rejects UserOp signing after eth_sendTransaction fails in self-auth mode', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn() // eth_sendTransaction returns undefined → falls to UserOp
    // UserOp signing rejected by user
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('User rejected the request'),
    )

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: CANONICAL_CSW,
          sendTransaction,
          request,
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        ownerAddress: OWNER_EOA,
        signerAddress: CANONICAL_CSW,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession,
      }),
    ).rejects.toThrow('User rejected the request')
    // eth_sendTransaction was attempted first
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // UserOp was attempted once as fallback
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    // Should NOT fall back to non-typed UserOp when user rejected
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendTransaction).not.toHaveBeenCalled()
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
      'Wallet could not generate the Coinbase Smart Wallet signature/approval. Retry from the same Base/Zora smart wallet, and reconnect it if the sponsor session has gone stale.',
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

  it('surfaces a clear error when sponsored submission stalls after signature confirmation', async () => {
    // Test UserOp timeout with a non-self-auth signer (EOA owner) so it goes straight to UserOp path
    sendCoinbaseSmartWalletUserOperationMock.mockImplementation(
      async () =>
        await new Promise(() => {
          // intentionally never resolves
        }),
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
      'Smart wallet approval is taking too long after signature confirmation. Retry once; if this keeps happening, reconnect the same Coinbase wallet session.',
    )
  })

  it('normalizes typed-data timeout on EOA owner path (useTypedDataSigning always false for non-self-auth)', async () => {
    // In the new flow, non-self-auth signers always use useTypedDataSigning: false.
    // A typed-data timeout error from UserOp is normalized and surfaced immediately.
    const ensurePaymasterSession = vi.fn(async () => true)
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValueOnce(
      new Error('UserOperation failed: signTypedData (CSW EIP-712) timed out after 30s'),
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
        ensurePaymasterSession,
      }),
    ).rejects.toThrow(
      'Coinbase Smart Wallet signature confirmation timed out. Retry once; if it repeats, reconnect the same Base wallet session and approve again.',
    )

    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({ useTypedDataSigning: false }),
    )
  })

  it('normalizes AA23 error on EOA owner path without retry', async () => {
    // In the new flow, non-self-auth signers go straight to UserOp.
    // AA23 is not a retryable paymaster session error, so it throws immediately with normalization.
    const ensurePaymasterSession = vi.fn(async () => true)
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValueOnce(new Error('AA23 reverted (or OOG)'))

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
        ownerAddress: OWNER_EOA,
        ownerIndexLookupAddress: OWNER_EOA,
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession,
      }),
    ).rejects.toThrow(
      'Smart wallet signature validation failed during sponsorship (AA23). Reconnect the same Base smart wallet session and retry.',
    )

    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAddress: OWNER_EOA,
      }),
    )
  })

  it('self-auth falls back through eth_sendTransaction → UserOp(typed) → UserOp(non-typed) when sendTx and typed fail', async () => {
    // In the new self-auth flow: eth_sendTransaction FIRST, then UserOp(typed), then UserOp(non-typed).
    // Test: eth_sendTransaction fails, typed UserOp fails, non-typed UserOp succeeds.
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi
      .fn()
      // eth_sendTransaction fails (e.g. popup error)
      .mockRejectedValueOnce(new Error('eth_sendTransaction popup error'))
    sendCoinbaseSmartWalletUserOperationMock
      .mockRejectedValueOnce(new Error('Internal error typed'))
      .mockResolvedValueOnce({ transactionHash: TX_HASH })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction: vi.fn(async () => TX_HASH),
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      ownerIndexLookupAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession,
    })

    // eth_sendTransaction was attempted as primary path
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // Both UserOp attempts made as fallback (typed failed, non-typed succeeded)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(2)
    // No addSubAccount or wallet_sendCalls
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addSubAccount' }),
    )
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(result.txHash).toBe(TX_HASH)
  })

  it('self-auth tries eth_sendTransaction then falls to UserOp when request returns undefined', async () => {
    // In self-auth mode, the primary path is eth_sendTransaction.
    // When request mock returns undefined (no tx hash), falls to UserOp.
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn() // returns undefined → triggers fallback

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction: vi.fn(async () => TX_HASH),
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

    // eth_sendTransaction was attempted first
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    )
    // UserOp succeeds as fallback
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    // sendCalls should NOT be called
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(result.txHash).toBe(TX_HASH)
  })

  it('self-auth eth_sendTransaction primary path succeeds and skips UserOp fallbacks', async () => {
    // Test the eth_sendTransaction primary path for self-auth mode.
    // When eth_sendTransaction succeeds, no UserOp or prepareCalls fallback is needed.
    const request = vi.fn()
      .mockImplementation(async (args: { method: string; params?: unknown[] }) => {
        if (args.method === 'eth_sendTransaction') {
          return TX_HASH
        }
        return null
      })

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: CANONICAL_CSW,
        sendTransaction: vi.fn(async () => TX_HASH),
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
      ensurePaymasterSession: async () => true,
    })

    // eth_sendTransaction was called as primary path
    const sendTxCalls = request.mock.calls.filter(
      (c: any[]) => c[0]?.method === 'eth_sendTransaction'
    )
    expect(sendTxCalls.length).toBe(1)
    // Verify correct tx params were passed
    const txParams = sendTxCalls[0]![0]!.params[0] as Record<string, unknown>
    expect(txParams.from).toBe(CANONICAL_CSW)
    expect(txParams.to).toBe(CANONICAL_CSW)
    expect(txParams.data).toBe(TX_REQUEST.data)
    expect(txParams.value).toBe('0x0')

    // No prepareCalls, sendPreparedCalls, or wallet_sendCalls
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendPreparedCalls' }),
    )
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    // UserOp was NOT used (eth_sendTransaction succeeded)
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('retries confirm-owner for pending confirmation states and succeeds after delayed indexing', async () => {
    const onStageEvent = vi.fn()
    apiFetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: {
            isOwner: false,
            canonicalCswAddress: CANONICAL_CSW,
            ownerAddress: OWNER_EOA,
            txHash: TX_HASH,
            confirmationState: 'pending_tx',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: {
            isOwner: false,
            canonicalCswAddress: CANONICAL_CSW,
            ownerAddress: OWNER_EOA,
            txHash: TX_HASH,
            confirmationState: 'owner_not_found_yet',
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
            confirmationState: 'owner_confirmed',
          },
        }),
      )

    const result = await sendPreparedOwnerTx({
      txRequest: TX_REQUEST,
      walletClient: {
        account: OWNER_EOA,
        sendTransaction: vi.fn(async () => TX_HASH),
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      ownerAddress: OWNER_EOA,
      signerAddress: OWNER_EOA,
      executionMode: 'ownerDirect',
      approvalRunId: 'approval-test-1',
      onStageEvent,
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(3)
    expect(result.isOwner).toBe(true)
    expect(onStageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'approval-test-1',
        stage: 'confirm_owner',
        status: 'retry',
        code: 'pending_tx',
      }),
    )
  })

  it('surfaces tx_failed confirmation state without retrying', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        data: {
          isOwner: false,
          canonicalCswAddress: CANONICAL_CSW,
          ownerAddress: OWNER_EOA,
          txHash: TX_HASH,
          confirmationState: 'tx_failed',
        },
        error: 'Owner install transaction failed onchain.',
      }),
    )

    await expect(
      sendPreparedOwnerTx({
        txRequest: TX_REQUEST,
        walletClient: {
          account: OWNER_EOA,
          sendTransaction: vi.fn(async () => TX_HASH),
        },
        chainId: 8453,
        authHeaders: async () => ({ Authorization: 'Bearer test' }),
        ownerAddress: OWNER_EOA,
        signerAddress: OWNER_EOA,
        executionMode: 'ownerDirect',
      }),
    ).rejects.toThrow('Owner install transaction failed onchain.')
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes canonical typed-data timeout error for user guidance', async () => {
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('UserOperation failed: signTypedData (CSW EIP-712) timed out after 30s'),
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
      'Coinbase Smart Wallet signature confirmation timed out. Retry once; if it repeats, reconnect the same Base wallet session and approve again.',
    )
  })

  it('does not remap paymaster insufficient funds errors into wallet-balance guidance', async () => {
    sendCoinbaseSmartWalletUserOperationMock.mockRejectedValue(
      new Error('Paymaster rejected this request: insufficient funds in paymaster'),
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
      'Gas sponsorship was rejected for this approval (insufficient funds in paymaster). Retry in Base app after reconnecting the same wallet session.',
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
