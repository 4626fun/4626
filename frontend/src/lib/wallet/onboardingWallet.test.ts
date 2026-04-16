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

  it('uses wallet_sendCalls first when canonical mode is self-authenticated by CSW session', async () => {
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

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('falls back to UserOp when wallet_sendCalls fails in self-auth mode', async () => {
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi.fn().mockRejectedValue(new Error('Method not found'))

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

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(result.txHash).toBe(TX_HASH)
  })

  it('does not call user-rejected wallet_sendCalls fallback to UserOp in self-auth mode', async () => {
    const sendTransaction = vi.fn(async () => TX_HASH)
    const ensurePaymasterSession = vi.fn(async () => true)
    // Message must match isUserRejectedWalletAction patterns ("user rejected", "user denied", or "rejected the request")
    const request = vi.fn().mockRejectedValue(new Error('User rejected the request'))

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
        signerAddress: CANONICAL_CSW,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        publicClient: {},
        ensurePaymasterSession,
      }),
    ).rejects.toThrow('User rejected the request')
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
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

  it('self-auth falls back to UserOp when sendCalls fails, then succeeds on retry', async () => {
    // In the new self-auth flow: sendCalls FIRST, then UserOp fallback.
    // Test: sendCalls fails with a non-user-rejection error, UserOp fallback succeeds.
    const ensurePaymasterSession = vi.fn(async () => true)
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Internal JSON-RPC error'))
    sendCoinbaseSmartWalletUserOperationMock.mockResolvedValueOnce({ transactionHash: TX_HASH })

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

    // sendCalls tried first, failed
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    // Then UserOp fallback succeeded
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(result.txHash).toBe(TX_HASH)
  })

  it('sends wallet_sendCalls without paymaster capabilities when no direct CDP URL is configured', async () => {
    // When VITE_CDP_SENDCALLS_PAYMASTER_URL is unset (test env default),
    // sendCalls is sent without paymaster capabilities. The extension may
    // still sponsor via its own mechanisms (Coinbase balance, Magic Spend).
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

    // sendCalls should be called without capabilities (no direct CDP URL in test env)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'wallet_sendCalls',
        params: [expect.not.objectContaining({ capabilities: expect.anything() })],
      }),
    )
    // getCallsStatus poll
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'wallet_getCallsStatus' }),
    )
    // UserOps should NOT have been attempted — sendCalls succeeded
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('sends wallet_sendCalls with chain-keyed AND flat paymaster capabilities when CDP URL is set', async () => {
    // Stub the env var that supplies the direct CDP paymaster URL.
    // Use api.developer.coinbase.com to verify the domain normalisation
    // to api.cdp.coinbase.com (required by keys.coinbase.com CSP).
    vi.stubEnv('VITE_CDP_SENDCALLS_PAYMASTER_URL', 'https://api.developer.coinbase.com/rpc/v1/base/TESTKEY')
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
        sendTransaction: vi.fn(async () => TX_HASH),
        request,
      },
      chainId: 8453,
      authHeaders: async () => ({ Authorization: 'Bearer test' }),
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
      publicClient: {},
    })

    // Capabilities should contain BOTH flat and chain-keyed paymaster formats
    // AND the domain should be normalised to api.cdp.coinbase.com
    const normalised = 'https://api.cdp.coinbase.com/rpc/v1/base/TESTKEY'
    const sendCallsPayload = request.mock.calls[0][0].params[0]
    expect(sendCallsPayload.capabilities).toBeDefined()
    expect(sendCallsPayload.capabilities.paymasterUrl).toBe(normalised)
    expect(sendCallsPayload.capabilities.paymasterService).toBeDefined()
    expect(sendCallsPayload.capabilities.paymasterService.url).toBe(normalised)
    // Chain-keyed entry for Base (0x2105)
    expect(sendCallsPayload.capabilities.paymasterService['0x2105']).toBeDefined()
    expect(sendCallsPayload.capabilities.paymasterService['0x2105'].url).toBe(normalised)

    expect(result.txHash).toBe(TX_HASH)
    vi.unstubAllEnvs()
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
