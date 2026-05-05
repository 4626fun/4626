import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { encodeAbiParameters, hashMessage, keccak256, toHex } from 'viem'
import { generatePrivateKey, privateKeyToAccount, sign as viemSign } from 'viem/accounts'

import {
  _submitOwnerViaSelfBuiltUserOp,
  _submitOwnerViaPreparedCallsWithEoaOwner,
  preflightOwnerKeyMismatch,
  sendPreparedOwnerTx,
} from './onboardingWallet'

const CANONICAL_CSW = '0x1111111111111111111111111111111111111111' as const
const OWNER_EOA = '0x2222222222222222222222222222222222222222' as const
const ALT_OWNER_EOA = '0x3333333333333333333333333333333333333333' as const
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

  afterEach(() => {
    vi.unstubAllGlobals()
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





  it('routes self-auth embedded-owner installs through replayable prepared-calls lane first', async () => {
    const webauthnSignature = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
            { name: 'challengeIndex', type: 'uint256' },
            { name: 'typeIndex', type: 'uint256' },
            { name: 'r', type: 'uint256' },
            { name: 's', type: 'uint256' },
          ],
        },
      ],
      [
        {
          authenticatorData: `0x${'ab'.repeat(37)}`,
          clientDataJSON:
            '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}',
          challengeIndex: 23n,
          typeIndex: 1n,
          r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
          s: 0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
        },
      ],
    )
    const signatureWrapper = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [0n, webauthnSignature],
    ) as `0x${string}`
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x0000000000000000000000000000000000000000000000002105000000000001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )),
    )
    apiFetchMock.mockImplementation(async () =>
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
    let personalSignCalls = 0
    const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x307838396239663138306435326431343533376466313535346630323035313266623134646539393566303834613836633163666435303566633531353963313664' },
          userOp: { dummy: true },
        }
      }
      if (args.method === 'personal_sign') {
        return signatureWrapper
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return 'bundle-1'
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: TX_HASH }],
        }
      }
      throw new Error(`Unexpected method ${args.method}`)
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
      ownerAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'personal_sign' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_prepareCalls' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_sendPreparedCalls' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_getCallsStatus' }))
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/relay/execute', expect.anything())
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('does not route embedded-owner self-auth lane through eth_sendTransaction', async () => {
    const webauthnSignature = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
            { name: 'challengeIndex', type: 'uint256' },
            { name: 'typeIndex', type: 'uint256' },
            { name: 'r', type: 'uint256' },
            { name: 's', type: 'uint256' },
          ],
        },
      ],
      [
        {
          authenticatorData: `0x${'ab'.repeat(37)}`,
          clientDataJSON:
            '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}',
          challengeIndex: 23n,
          typeIndex: 1n,
          r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
          s: 0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
        },
      ],
    )
    const signatureWrapper = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [0n, webauthnSignature],
    ) as `0x${string}`
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x0000000000000000000000000000000000000000000000002105000000000001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )),
    )
    apiFetchMock.mockImplementation(async () =>
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
    const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x307838396239663138306435326431343533376466313535346630323035313266623134646539393566303834613836633163666435303566633531353963313664' },
          userOp: { dummy: true },
        }
      }
      if (args.method === 'personal_sign') {
        expect(args.params?.[1]).toBe(CANONICAL_CSW)
        return signatureWrapper
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return 'bundle-1'
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: TX_HASH }],
        }
      }
      throw new Error(`Unexpected method ${args.method}`)
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
      ownerAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'personal_sign' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }))
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/relay/execute', expect.anything())
    expect(result.txHash).toBe(TX_HASH)
  })

  it('retries standard prepared-calls lane before relay when replayable prepared-calls signature fails', async () => {
    const webauthnSignature = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
            { name: 'challengeIndex', type: 'uint256' },
            { name: 'typeIndex', type: 'uint256' },
            { name: 'r', type: 'uint256' },
            { name: 's', type: 'uint256' },
          ],
        },
      ],
      [
        {
          authenticatorData: `0x${'ab'.repeat(37)}`,
          clientDataJSON:
            '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}',
          challengeIndex: 23n,
          typeIndex: 1n,
          r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
          s: 0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
        },
      ],
    )
    const signatureWrapper = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [0n, webauthnSignature],
    ) as `0x${string}`
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x0000000000000000000000000000000000000000000000002105000000000001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )),
    )
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/relay/execute') {
        return makeJsonResponse({
          success: true,
          data: { txHash: TX_HASH },
        })
      }
      return makeJsonResponse({
        success: true,
        data: {
          isOwner: true,
          canonicalCswAddress: CANONICAL_CSW,
          ownerAddress: OWNER_EOA,
          txHash: TX_HASH,
          confirmationState: 'owner_confirmed',
        },
      })
    })
    let personalSignCalls = 0
    const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x307838396239663138306435326431343533376466313535346630323035313266623134646539393566303834613836633163666435303566633531353963313664' },
          userOp: { dummy: true },
        }
      }
      if (args.method === 'personal_sign') {
        personalSignCalls += 1
        if (personalSignCalls === 1) {
          const popupErr = new Error('Provider request failed')
          popupErr.stack =
            'Error: Provider request failed\n    at vGe (https://keys.coinbase.com/static/main.js:2:1)'
          throw popupErr
        }
        return signatureWrapper
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return 'bundle-1'
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: TX_HASH }],
        }
      }
      throw new Error(`Unexpected method ${args.method}`)
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
      ownerAddress: OWNER_EOA,
      signerAddress: CANONICAL_CSW,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_prepareCalls' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'personal_sign' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_sendPreparedCalls' }))
    expect(apiFetchMock).toHaveBeenCalledWith('/api/relay/execute', expect.anything())
    expect(result.txHash).toBe(TX_HASH)
  })

  it('surfaces relay fallback signature-shape error when popup self-call is blocked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: '0x0000000000000000000000000000000000000000000000002105000000000001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )),
    )
    const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_sendTransaction') {
        throw new Error('Self calls are not allowed.')
      }
      if (args.method === 'personal_sign') {
        // 224-byte ECDSA wrapper (ownerIndex=2) — known bad for the owner[0] WebAuthn lane.
        const badEcdsaWrapper = (`0x${'00'.repeat(32)}${'00'.repeat(32)}${'02'.padStart(64, '0')}${'00'.repeat(64)}`) as `0x${string}`
        return badEcdsaWrapper
      }
      throw new Error(`Unexpected method ${args.method}`)
    })

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
        ownerAddress: OWNER_EOA,
        signerAddress: CANONICAL_CSW,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
      }),
    ).rejects.toThrow(/acceptable owner signature/i)
  })

  it('uses replayable prepared-calls for embedded-owner when wallet account is canonical CSW', async () => {
    const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x307838396239663138306435326431343533376466313535346630323035313266623134646539393566303834613836633163666435303566633531353963313664' },
          userOp: { dummy: true },
        }
      }
      if (args.method === 'personal_sign') {
        const webauthnSignature = encodeAbiParameters(
          [
            {
              type: 'tuple',
              components: [
                { name: 'authenticatorData', type: 'bytes' },
                { name: 'clientDataJSON', type: 'string' },
                { name: 'challengeIndex', type: 'uint256' },
                { name: 'typeIndex', type: 'uint256' },
                { name: 'r', type: 'uint256' },
                { name: 's', type: 'uint256' },
              ],
            },
          ],
          [
            {
              authenticatorData: `0x${'ab'.repeat(37)}`,
              clientDataJSON:
                '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}',
              challengeIndex: 23n,
              typeIndex: 1n,
              r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
              s: 0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
            },
          ],
        )
        return encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'bytes' }],
          [0n, webauthnSignature],
        ) as `0x${string}`
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return 'bundle-1'
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: TX_HASH }],
        }
      }
      throw new Error(`Unexpected method ${args.method}`)
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
      ownerAddress: OWNER_EOA,
      signerAddress: OWNER_EOA,
      executionMode: 'canonicalSmartWallet',
      canonicalSmartWalletAddress: CANONICAL_CSW,
    })

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_prepareCalls' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'personal_sign' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_sendPreparedCalls' }))
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_getCallsStatus' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }))
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/relay/execute', expect.anything())
    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(result.txHash).toBe(TX_HASH)
  })

  it('requires canonical self-auth session for embedded-owner install when strict mode is enabled', async () => {
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
        signerAddress: OWNER_EOA,
        executionMode: 'canonicalSmartWallet',
        canonicalSmartWalletAddress: CANONICAL_CSW,
        enforceSelfAuthEmbeddedOwner: true,
      }),
    ).rejects.toThrow(
      'Reconnect with your canonical Coinbase Smart Wallet session in Base App to enable 4626 signing.',
    )

    expect(sendCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect(apiFetchMock).not.toHaveBeenCalled()
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

describe('_submitOwnerViaSelfBuiltUserOp', () => {
  it('fails early when addOwner target does not match intended owner', async () => {
    await expect(
      _submitOwnerViaSelfBuiltUserOp({
        walletRequest: vi.fn(),
        chainId: 8453,
        csw: CANONICAL_CSW,
        innerCallData: TX_REQUEST.data,
        expectedOwnerAddress: ALT_OWNER_EOA,
      }),
    ).rejects.toThrow(
      `Prepared addOwnerAddress target ${OWNER_EOA} does not match intended owner ${ALT_OWNER_EOA}`,
    )
  })
})

// ── Helpers for the mismatch-guard / EOA-lane tests ───────────────────
function encodeOwnerAtIndexResult(ownerAddress: `0x${string}`): `0x${string}` {
  // ownerAtIndex returns `bytes`. The bytes payload is an ABI-encoded
  // address (32 bytes, left-padded). Wrap that in the `bytes` ABI envelope.
  const ownerBytes = encodeAbiParameters([{ type: 'address' }], [ownerAddress])
  return encodeAbiParameters([{ type: 'bytes' }], [ownerBytes])
}

function wrapSignatureWithOwnerIndex(ownerIndex: number, ecdsa: `0x${string}`): `0x${string}` {
  // SignatureWrapper(uint256 ownerIndex, bytes signatureData)
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), ecdsa],
  )
}

async function ecdsaSignRaw(privateKey: `0x${string}`, hash: `0x${string}`): Promise<`0x${string}`> {
  return (await viemSign({ hash, privateKey, to: 'hex' })) as `0x${string}`
}

async function ecdsaSignEip191(privateKey: `0x${string}`, hash: `0x${string}`): Promise<`0x${string}`> {
  // Sign keccak256(\x19Ethereum Signed Message:\n32 || hash) — the digest a
  // standards-compliant `personal_sign` signs over.
  const eip191Digest = hashMessage({ raw: hash })
  return (await viemSign({ hash: eip191Digest, privateKey, to: 'hex' })) as `0x${string}`
}

describe('preflightOwnerKeyMismatch (raw + EIP-191 dual recovery)', () => {
  const HASH_TO_SIGN = keccak256(toHex('user-op-hash-fixture')) as `0x${string}`
  const SENDER = '0xCfDDdfDdfdDdfddFdDdfDdFdDdfDDfDdfDdFdDdf' as `0x${string}`
  const OWNER_INDEX = 0

  function makeWalletRequestMock(ownerAddress: `0x${string}`) {
    return vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_call') {
        return encodeOwnerAtIndexResult(ownerAddress)
      }
      if (args.method === 'eth_getCode') {
        return '0x' // EOA, no code
      }
      throw new Error(`unexpected RPC ${args.method}`)
    })
  }

  it('passes when raw recovery matches the on-chain owner', async () => {
    const pk = generatePrivateKey()
    const account = privateKeyToAccount(pk)
    const ecdsa = await ecdsaSignRaw(pk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(account.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
    })

    expect(outcome.kind).toBe('ok')
    if (outcome.kind === 'ok') {
      expect(outcome.recoveredAddress.toLowerCase()).toBe(account.address.toLowerCase())
      expect(outcome.recoveredRawAddress?.toLowerCase()).toBe(account.address.toLowerCase())
    }
  })

  it('passes when only the EIP-191-prefixed recovery matches the on-chain owner', async () => {
    const pk = generatePrivateKey()
    const account = privateKeyToAccount(pk)
    // The connector returned a personal_sign-style signature. Raw ecrecover
    // over userOpHash will recover to a *different* address (the address
    // that would have signed the raw hash with these r/s/v values), but
    // EIP-191 recovery lands on the actual signer.
    const ecdsa = await ecdsaSignEip191(pk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(account.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
    })

    expect(outcome.kind).toBe('ok')
    if (outcome.kind === 'ok') {
      expect(outcome.recoveredEip191Address?.toLowerCase()).toBe(account.address.toLowerCase())
    }
  })

  it('flags mismatch with both recovered addresses in the outcome when neither matches', async () => {
    const signerPk = generatePrivateKey()
    const wrongOwnerPk = generatePrivateKey()
    const wrongOwnerAccount = privateKeyToAccount(wrongOwnerPk)
    const ecdsa = await ecdsaSignRaw(signerPk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(wrongOwnerAccount.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
    })

    expect(outcome.kind).toBe('mismatch')
    if (outcome.kind === 'mismatch') {
      expect(outcome.recoveredRawAddress).not.toBeNull()
      expect(outcome.recoveredEip191Address).not.toBeNull()
      expect(outcome.recoveredRawAddress?.toLowerCase()).not.toBe(wrongOwnerAccount.address.toLowerCase())
      expect(outcome.recoveredEip191Address?.toLowerCase()).not.toBe(wrongOwnerAccount.address.toLowerCase())
    }
  })

  it('returns unknown (does not throw) when the ECDSA bytes are completely malformed', async () => {
    // 65 zero bytes — both recovery paths reject this signature.
    const ecdsa = (`0x${'00'.repeat(65)}`) as `0x${string}`
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)
    const ownerAddress = privateKeyToAccount(generatePrivateKey()).address as `0x${string}`

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(ownerAddress),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
    })

    expect(outcome.kind).toBe('unknown')
    if (outcome.kind === 'unknown') {
      expect(outcome.reason).toMatch(/ecrecover failed/i)
    }
  })

  it('skips ecrecover and returns skipped_webauthn for a passkey-shaped signature', async () => {
    // Hand-craft a WebAuthnAuth tuple. The exact bytes don't matter — we only
    // need detectSignatureShape to recognize it, so the guard short-circuits
    // before calling eth_call / ecrecover. The walletRequest mock would throw
    // on any unexpected RPC; verifying it's not called confirms the skip.
    const authenticatorData = (`0x${'ab'.repeat(37)}`) as `0x${string}`
    const clientDataJSON =
      '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}'
    const webauthnSignature = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
            { name: 'challengeIndex', type: 'uint256' },
            { name: 'typeIndex', type: 'uint256' },
            { name: 'r', type: 'uint256' },
            { name: 's', type: 'uint256' },
          ],
        },
      ],
      [
        {
          authenticatorData,
          clientDataJSON,
          challengeIndex: 23n,
          typeIndex: 1n,
          r: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn,
          s: 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321n,
        },
      ],
    )
    // Throwing mock proves the guard doesn't try to look up an owner or run
    // ecrecover — the webauthn-shape branch must short-circuit before any RPC.
    const walletRequest = vi.fn(async () => {
      throw new Error('walletRequest must not be called for webauthn shape')
    })

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest,
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature: webauthnSignature,
    })

    expect(outcome.kind).toBe('skipped_webauthn')
    if (outcome.kind === 'skipped_webauthn') {
      expect(outcome.reason).toMatch(/webauthn/i)
    }
    expect(walletRequest).not.toHaveBeenCalled()
  })

  // Self-auth Base App / CSW session: the connected wallet provider IS the
  // CSW itself, so the popup may legitimately return an ephemeral sub-account
  // session-key ECDSA that does not ecrecover to the parsed on-chain owner.
  // The bundler validates that signature via Coinbase's sub-account /
  // ERC-1271 path; the local mismatch guard must not block submission.
  it('downgrades a would-be ECDSA mismatch to skipped_self_auth_session_key when sessionKind=self_auth', async () => {
    const signerPk = generatePrivateKey()
    const onChainOwnerPk = generatePrivateKey()
    const onChainOwnerAccount = privateKeyToAccount(onChainOwnerPk)
    // Sign with `signerPk` but the on-chain owner is `onChainOwnerAccount` —
    // ecrecover lands on a different address, the classic substitution shape.
    const ecdsa = await ecdsaSignRaw(signerPk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(onChainOwnerAccount.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
      sessionKind: 'self_auth',
    })

    expect(outcome.kind).toBe('skipped_self_auth_session_key')
    if (outcome.kind === 'skipped_self_auth_session_key') {
      expect(outcome.parsedOwnerIndex).toBe(OWNER_INDEX)
      expect(outcome.parsedOwnerAddress.toLowerCase()).toBe(
        onChainOwnerAccount.address.toLowerCase(),
      )
      // Recovered keys are still surfaced for telemetry — they just don't
      // match the on-chain owner.
      expect(outcome.recoveredRawAddress).not.toBeNull()
      expect(outcome.recoveredRawAddress?.toLowerCase()).not.toBe(
        onChainOwnerAccount.address.toLowerCase(),
      )
    }
  })

  it('still flags a real mismatch when sessionKind=external_signer (default behavior)', async () => {
    const signerPk = generatePrivateKey()
    const onChainOwnerPk = generatePrivateKey()
    const onChainOwnerAccount = privateKeyToAccount(onChainOwnerPk)
    const ecdsa = await ecdsaSignRaw(signerPk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(onChainOwnerAccount.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
      sessionKind: 'external_signer',
    })

    expect(outcome.kind).toBe('mismatch')
  })

  it('still returns ok under sessionKind=self_auth when the signature legitimately matches the on-chain owner', async () => {
    // Self-auth must NOT mask correct signatures — happy-path EOA owner
    // installed at index 0 still recovers cleanly to the on-chain address.
    const pk = generatePrivateKey()
    const account = privateKeyToAccount(pk)
    const ecdsa = await ecdsaSignRaw(pk, HASH_TO_SIGN)
    const signature = wrapSignatureWithOwnerIndex(OWNER_INDEX, ecdsa)

    const outcome = await preflightOwnerKeyMismatch({
      walletRequest: makeWalletRequestMock(account.address as `0x${string}`),
      sender: SENDER,
      hashToSign: HASH_TO_SIGN,
      signature,
      sessionKind: 'self_auth',
    })

    expect(outcome.kind).toBe('ok')
  })
})

describe('_submitOwnerViaPreparedCallsWithEoaOwner (split transports)', () => {
  const SENDER = '0x4444444444444444444444444444444444444444' as `0x${string}`
  const TARGET = '0x5555555555555555555555555555555555555555' as `0x${string}`
  const RECEIPT_HASH = `0x${'b'.repeat(64)}` as `0x${string}`

  it('routes wallet_prepareCalls + wallet_sendPreparedCalls to cswRequest and personal_sign to signerRequest', async () => {
    const pk = generatePrivateKey()
    const account = privateKeyToAccount(pk)
    const eoaOwnerAddress = account.address as `0x${string}`
    const userOpHash = keccak256(toHex('user-op-hash-eoa-lane')) as `0x${string}`
    const rawSig = await ecdsaSignRaw(pk, userOpHash)

    const cswRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: userOpHash },
          userOp: { dummy: true },
          capabilities: {},
        }
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return 'bundle-1'
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: RECEIPT_HASH }],
        }
      }
      throw new Error(`unexpected csw RPC ${args.method}`)
    })

    const signerRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'personal_sign') {
        return rawSig
      }
      throw new Error(`unexpected signer RPC ${args.method}`)
    })

    const result = await _submitOwnerViaPreparedCallsWithEoaOwner({
      cswRequest,
      signerRequest,
      eoaOwnerAddress,
      eoaOwnerIndex: 0,
      chainId: 8453,
      sender: SENDER,
      to: TARGET,
      data: '0xdeadbeef',
      paymasterUrl: null,
      approvalRunId: 'test-approval',
      executionMode: 'canonicalSmartWallet',
      canonicalCswAddress: SENDER,
    })

    expect(result).toBe(RECEIPT_HASH)

    const cswMethods = cswRequest.mock.calls.map((c) => (c[0] as { method: string }).method)
    expect(cswMethods).toContain('wallet_prepareCalls')
    expect(cswMethods).toContain('wallet_sendPreparedCalls')
    expect(cswMethods).toContain('wallet_getCallsStatus')
    expect(cswMethods).not.toContain('personal_sign')

    const signerMethods = signerRequest.mock.calls.map((c) => (c[0] as { method: string }).method)
    expect(signerMethods).toEqual(['personal_sign'])
    expect(signerRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'personal_sign',
        params: [userOpHash, eoaOwnerAddress],
      }),
    )
  })
})
