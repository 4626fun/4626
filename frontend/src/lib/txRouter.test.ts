import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendCoinbaseSmartWalletUserOperationMock, testDataSuffix } = vi.hoisted(() => ({
  sendCoinbaseSmartWalletUserOperationMock: vi.fn(),
  testDataSuffix: '0xfacecafe' as const,
}))

vi.mock('@/lib/aa/coinbaseErc4337', () => ({
  sendCoinbaseSmartWalletUserOperation: sendCoinbaseSmartWalletUserOperationMock,
}))

vi.mock('@/lib/baseBuilderCodes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/baseBuilderCodes')>('@/lib/baseBuilderCodes')
  return {
    ...actual,
    appendBuilderSuffixToHex: (data: `0x${string}` | undefined, options?: { chainId?: number | null }) =>
      actual.appendBuilderSuffixToHex(data, {
        ...options,
        dataSuffix: testDataSuffix,
      }),
  }
})

import {
  buildAndSendApproval,
  buildAndSendSwap,
  detectTxSendMode,
  normalizeCanonicalSendError,
  type TxRouterContext,
} from './txRouter'
import { payloadEndsWithDataSuffix } from '@/lib/baseBuilderCodes'
import { TARGET_ALLOWED_OWNER_EOA_ADDRESSES, TARGET_CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const ADDRESS_A = '0x1111111111111111111111111111111111111111' as const
const ADDRESS_B = '0x2222222222222222222222222222222222222222' as const
const ADDRESS_C = '0x3333333333333333333333333333333333333333' as const
const HASH_A = `0x${'a'.repeat(64)}`
const HASH_B = `0x${'b'.repeat(64)}`
const TEST_DATA_SUFFIX = testDataSuffix

function makeContext(overrides: Partial<TxRouterContext> = {}): TxRouterContext {
  return {
    chainId: 8453,
    executionMode: 'canonical',
    walletClient: {
      request: vi.fn(),
      sendTransaction: vi.fn(),
    },
    publicClient: {},
    canonicalAddress: ADDRESS_A,
    signerAddress: ADDRESS_B,
    executionAddress: ADDRESS_A,
    signerType: 'EOA',
    connectorId: 'coinbaseWalletSDK',
    connectorName: 'Coinbase Wallet',
    capabilities: {
      paymasterService: false,
      atomicStatus: 'unknown',
      supports5792: false,
    },
    ...overrides,
  }
}

describe('txRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendCoinbaseSmartWalletUserOperationMock.mockResolvedValue({ transactionHash: HASH_A })
  })

  it('detects wallet_sendCalls mode in canonical smart-wallet capable contexts', () => {
    const context = makeContext({
      executionMode: 'canonical',
      capabilities: {
        paymasterService: true,
        atomicStatus: 'supported',
        supports5792: true,
      },
    })

    const decision = detectTxSendMode(context)
    expect(decision.mode).toBe('sendCalls')
    expect(decision.fallbackMode).toBe('canonicalDirect')
  })

  it('falls back from wallet_sendCalls to canonical ERC-4337 when unsupported for approval+swap', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'wallet_sendCalls') throw new Error('Method not found')
      throw new Error(`unexpected method: ${method}`)
    })
    const sendTransaction = vi.fn(async () => HASH_A)
    const context = makeContext({
      signerType: 'SMART_WALLET',
      walletClient: {
        request,
        sendTransaction,
      },
      capabilities: {
        paymasterService: true,
        atomicStatus: 'supported',
        supports5792: true,
      },
    })

    const result = await buildAndSendSwap({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0x1234',
        value: '0',
        chainId: 8453,
      },
      swapTx: {
        to: ADDRESS_B,
        from: ADDRESS_B,
        data: '0x5678',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('sendCalls')
    expect(result.send.mode).toBe('canonical4337')
    expect(result.send.method).toBe('eth_sendUserOperation')
    expect(result.send.transactionHash).toBe(HASH_A)
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
  })

  it('falls back when provider returns unsupported-method code shape', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'wallet_sendCalls') {
        throw {
          code: 4200,
          shortMessage: 'Unsupported method',
        }
      }
      throw new Error(`unexpected method: ${method}`)
    })
    const sendTransaction = vi.fn(async () => HASH_A)
    const context = makeContext({
      signerType: 'SMART_WALLET',
      walletClient: {
        request,
        sendTransaction,
      },
      capabilities: {
        paymasterService: true,
        atomicStatus: 'supported',
        supports5792: true,
      },
    })

    const result = await buildAndSendApproval({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0x1234',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('sendCalls')
    expect(result.send.mode).toBe('canonicalDirect')
    expect(result.send.method).toBe('walletClient.sendTransaction')
    expect(sendTransaction).toHaveBeenCalledTimes(1)
  })

  it('does not fallback on user-rejected sendCalls errors', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'wallet_sendCalls') {
        throw {
          code: 4001,
          message: 'User rejected the request',
        }
      }
      throw new Error(`unexpected method: ${method}`)
    })
    const sendTransaction = vi.fn(async () => HASH_A)
    const context = makeContext({
      signerType: 'SMART_WALLET',
      walletClient: {
        request,
        sendTransaction,
      },
      capabilities: {
        paymasterService: true,
        atomicStatus: 'supported',
        supports5792: true,
      },
    })

    await expect(
      buildAndSendApproval({
        context,
        approvalTx: {
          to: ADDRESS_C,
          from: ADDRESS_B,
          data: '0x1234',
          value: '0',
          chainId: 8453,
        },
      }),
    ).rejects.toBeTruthy()
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('uses canonical ERC-4337 path when sendCalls is unavailable and signer is EOA', async () => {
    const context = makeContext({
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
      walletClient: {
        request: vi.fn(),
        sendTransaction: vi.fn(),
      },
    })

    const result = await buildAndSendApproval({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0x1234',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('canonical4337')
    expect(result.send.mode).toBe('canonical4337')
    expect(result.send.method).toBe('eth_sendUserOperation')
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(TEST_DATA_SUFFIX).toBeDefined()
    const forwardedData = sendCoinbaseSmartWalletUserOperationMock.mock.calls[0]?.[0]?.calls?.[0]?.data
    expect(payloadEndsWithDataSuffix(forwardedData, TEST_DATA_SUFFIX!)).toBe(true)
  })

  it('locks canonical approval+swap sendCalls fallback to ERC-4337', async () => {
    const sendTransaction = vi.fn(async () => HASH_A)
    const context = makeContext({
      executionMode: 'canonical',
      signerType: 'SMART_WALLET',
      connectorId: 'coinbaseWalletSDK',
      connectorName: 'Coinbase Wallet',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
      walletClient: {
        request: vi.fn(),
        sendTransaction,
      },
      publicClient: {},
    })

    const result = await buildAndSendSwap({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0xaaaa',
        value: '0',
        chainId: 8453,
      },
      swapTx: {
        to: ADDRESS_A,
        from: ADDRESS_B,
        data: '0xbbbb',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('sendCalls')
    expect(result.routing.fallbackMode).toBe('canonical4337')
    expect(result.send.mode).toBe('canonical4337')
    expect(result.send.method).toBe('eth_sendUserOperation')
    expect(sendTransaction).not.toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
  })

  it('keeps approval and swap in the same direct EOA route family', async () => {
    const sendTransaction = vi
      .fn()
      .mockResolvedValueOnce(HASH_A)
      .mockResolvedValueOnce(HASH_B)
    const context = makeContext({
      executionMode: 'eoa',
      canonicalAddress: null,
      signerAddress: ADDRESS_B,
      executionAddress: ADDRESS_B,
      signerType: 'EOA',
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
      walletClient: {
        sendTransaction,
      },
    })

    const result = await buildAndSendSwap({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0xaaaa',
        value: '0',
        chainId: 8453,
      },
      swapTx: {
        to: ADDRESS_A,
        from: ADDRESS_B,
        data: '0xbbbb',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('eoaDirect')
    expect(result.send.mode).toBe('eoaDirect')
    expect(result.send.method).toBe('walletClient.sendTransaction')
    expect(result.send.txHashes).toEqual([HASH_A, HASH_B])
    expect(result.send.sender).toBe(ADDRESS_B)
  })

  it('adds Builder Codes suffix on outbound EOA request payloads', async () => {
    const request = vi.fn(async ({ method }: { method: string; params?: unknown[] }) => {
      if (method !== 'eth_sendTransaction') throw new Error(`unexpected method: ${method}`)
      return HASH_A
    })
    const context = makeContext({
      executionMode: 'eoa',
      canonicalAddress: null,
      signerAddress: ADDRESS_B,
      executionAddress: ADDRESS_B,
      signerType: 'EOA',
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
      walletClient: {
        request,
      },
    })

    const result = await buildAndSendApproval({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0x1234',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.send.mode).toBe('eoaDirect')
    expect(result.send.method).toBe('eth_sendTransaction')
    expect(TEST_DATA_SUFFIX).toBeDefined()
    const outboundRequest = request.mock.calls[0]?.[0] as
      | { params?: Array<{ data?: `0x${string}` }> }
      | undefined
    const outboundData = outboundRequest?.params?.[0]?.data
    expect(payloadEndsWithDataSuffix(outboundData, TEST_DATA_SUFFIX!)).toBe(true)
  })

  it('submits approval+swap through wallet_sendCalls when available', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'wallet_sendCalls') return '0xcallbundle'
      if (method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: HASH_A }],
        }
      }
      throw new Error(`unexpected method: ${method}`)
    })
    const context = makeContext({
      executionMode: 'canonical',
      walletClient: {
        request,
      },
      capabilities: {
        paymasterService: true,
        atomicStatus: 'supported',
        supports5792: true,
      },
    })

    const result = await buildAndSendSwap({
      context,
      approvalTx: {
        to: ADDRESS_B,
        from: ADDRESS_B,
        data: '0xaaaa',
        value: '0',
        chainId: 8453,
      },
      swapTx: {
        to: ADDRESS_C,
        from: ADDRESS_B,
        data: '0xbbbb',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('sendCalls')
    expect(result.send.mode).toBe('sendCalls')
    expect(result.send.method).toBe('wallet_sendCalls')
    expect(result.send.callsId).toBe('0xcallbundle')
    expect(result.send.transactionHash).toBe(HASH_A)
  })

  it('blocks non-canonical execution address for enforced canonical policy account', () => {
    const context = makeContext({
      executionMode: 'canonical',
      canonicalAddress: TARGET_CANONICAL_CSW_ADDRESS,
      executionAddress: ADDRESS_A,
      signerAddress: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
      signerType: 'EOA',
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })

    expect(() => detectTxSendMode(context)).toThrow(/canonical csw policy/i)
  })

  it('returns canonical sender identity for policy-enforced ERC-4337 sends', async () => {
    const context = makeContext({
      executionMode: 'canonical',
      canonicalAddress: TARGET_CANONICAL_CSW_ADDRESS,
      executionAddress: TARGET_CANONICAL_CSW_ADDRESS,
      signerAddress: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
      signerType: 'EOA',
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })

    const result = await buildAndSendApproval({
      context,
      approvalTx: {
        to: ADDRESS_C,
        from: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
        data: '0x1234',
        value: '0',
        chainId: 8453,
      },
    })

    expect(result.routing.mode).toBe('canonical4337')
    expect(result.send.mode).toBe('canonical4337')
    expect(result.send.sender).toBe(TARGET_CANONICAL_CSW_ADDRESS)
    expect(sendCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(sendCoinbaseSmartWalletUserOperationMock.mock.calls[0]?.[0]?.smartWallet).toBe(TARGET_CANONICAL_CSW_ADDRESS)
    expect(sendCoinbaseSmartWalletUserOperationMock.mock.calls[0]?.[0]?.ownerAddress).toBe(TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0])
  })

  it('blocks disallowed signer addresses for policy-enforced canonical account', async () => {
    const context = makeContext({
      executionMode: 'canonical',
      canonicalAddress: TARGET_CANONICAL_CSW_ADDRESS,
      executionAddress: TARGET_CANONICAL_CSW_ADDRESS,
      signerAddress: ADDRESS_B,
      signerType: 'EOA',
      connectorId: 'injected',
      connectorName: 'Injected',
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })

    await expect(
      buildAndSendApproval({
        context,
        approvalTx: {
          to: ADDRESS_C,
          from: ADDRESS_B,
          data: '0x1234',
          value: '0',
          chainId: 8453,
        },
      }),
    ).rejects.toThrow(/allowed owner signer/i)
  })

  it('normalizes unauthenticated paymaster errors into canonical session guidance', () => {
    expect(normalizeCanonicalSendError(new Error('request denied - not authenticated')).message).toBe(
      'Paymaster rejected the swap because your 4626 session is not authenticated.',
    )
  })

  it('normalizes canonical owner mismatch errors into explicit guidance', () => {
    expect(normalizeCanonicalSendError(new Error('not_owner: session principal does not own sender CSW')).message).toBe(
      'Session principal does not own sender CSW for canonical swap execution.',
    )
  })
})
