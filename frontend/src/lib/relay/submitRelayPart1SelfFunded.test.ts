import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, type Hex } from 'viem'

import {
  parseEntryPointPaymasterAddress,
  parseSelfAuthOwnerIndexFromSignature,
  parseWalletPreparedUserOpV06,
  readPreparedUserOpPaymasterAndData,
  buildSelfFundedRelayPrepareCapabilities,
  resolveSelfFundedSignHashAfterPaymasterStrip,
  listSelfAuthPreparedCallsSignaturePayloadModes,
  stripUserOpPaymaster,
  submitSelfAuthRelayPart1SelfFunded,
  userOpHasPaymaster,
} from '@/lib/relay/submitRelayPart1SelfFunded'

function wrapSelfAuthOwnerSignature(ownerIndex: number): Hex {
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), `0x${'22'.repeat(65)}` as Hex],
  ) as Hex
}

const mockGetUserOperationReceipt = vi.fn()
const mockBundlerRequest = vi.fn()

vi.mock('viem/account-abstraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/account-abstraction')>()
  return {
    ...actual,
    createBundlerClient: vi.fn(() => ({
      getUserOperationReceipt: mockGetUserOperationReceipt,
      request: mockBundlerRequest,
    })),
    waitForUserOperationReceipt: vi.fn(async () => ({
      receipt: { transactionHash: '0x' + 'cc'.repeat(32) },
    })),
  }
})

const mockSubmitOwnerViaSendCalls = vi.fn()

vi.mock('@/lib/wallet/cswSendCalls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/cswSendCalls')>()
  return {
    ...actual,
    _submitOwnerViaSendCalls: (...args: unknown[]) => mockSubmitOwnerViaSendCalls(...args),
  }
})

const SESSION_KEY_OWNER = '0xCf8D17Ce01B73637ef936fe7c47bA7100b820142' as const

const mockPublicClient = {
  getBalance: vi.fn(async () => 10_000_000_000_000_000n),
  readContract: vi.fn(async (args: { functionName?: string }) => {
    if (args.functionName === 'ownerAtIndex') {
      return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
    }
    return 500_000_000_000_000n
  }),
  getGasPrice: vi.fn(async () => 1_000_000_000n),
  chain: { id: 8453 },
}

const SAMPLE_USER_OP = {
  sender: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
  nonce: '0x1',
  initCode: '0x',
  callData: '0xb61d27f60000000000000000000000004cd00e387622c35bddb9b4c962c136462338bc31000000000000000000000000000000000000000000000001129e6ffe3f8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000049290c1c0000000000000000000000000000000000000000000000000000000000000000',
  callGasLimit: '0x5208',
  verificationGasLimit: '0x5208',
  preVerificationGas: '0x5208',
  maxFeePerGas: '0x1',
  maxPriorityFeePerGas: '0x1',
  paymasterAndData: '0x',
  signature: '0x',
}

describe('submitRelayPart1SelfFunded helpers', () => {
  it('detects empty paymasterAndData as self-funded (EntryPoint paymaster=0)', () => {
    expect(userOpHasPaymaster({ paymasterAndData: '0x' })).toBe(false)
    expect(parseEntryPointPaymasterAddress('0x')).toBeNull()
    expect(readPreparedUserOpPaymasterAndData({ paymasterAndData: '0x' })).toBe('0x')
  })

  it('detects non-empty paymasterAndData per EntryPoint _copyUserOpToMemory', () => {
    const paymaster = '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064'
    expect(userOpHasPaymaster({ paymasterAndData: paymaster })).toBe(true)
    expect(parseEntryPointPaymasterAddress(paymaster)).toBe('0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c')
  })

  it('strips paymasterAndData for self-funded resubmit', () => {
    const withPaymaster = {
      ...SAMPLE_USER_OP,
      paymasterAndData:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
    }
    const parsed = parseWalletPreparedUserOpV06(withPaymaster)
    const stripped = stripUserOpPaymaster(parsed)
    expect(stripped.paymasterAndData).toBe('0x')
    expect(stripped.signature).toBe('0x')
    expect(stripped.callData).toBe(parsed.callData)
  })

  it('recomputes sign hash after paymaster strip using prepare hash domain', () => {
    const withPaymaster = {
      ...SAMPLE_USER_OP,
      paymasterAndData:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
    }
    const preparedHash = resolveSelfFundedSignHashAfterPaymasterStrip({
      preparedUserOp: withPaymaster,
      signatureRequestHash: resolveSelfFundedSignHashAfterPaymasterStrip({
        preparedUserOp: withPaymaster,
        signatureRequestHash: '0x' + '00'.repeat(32),
        chainId: 8453,
      }).hash,
      chainId: 8453,
    })
    expect(preparedHash.hash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(['entrypoint_v06_chain', 'entrypoint_v06_no_chain', 'entrypoint_v06_chain_unmatched_prepare_hash']).toContain(
      preparedHash.mode,
    )
  })

  it('parses owner index from Base App signature wrapper', () => {
    expect(parseSelfAuthOwnerIndexFromSignature(wrapSelfAuthOwnerSignature(2))).toBe(2)
    expect(parseSelfAuthOwnerIndexFromSignature(`0x${'22'.repeat(65)}`)).toBeNull()
  })

  it('uses inner_secp256k1 first for Base App session-key owner index 2', () => {
    expect(listSelfAuthPreparedCallsSignaturePayloadModes({ parsedOwnerIndex: 2 })).toEqual([
      'inner_secp256k1',
      'full_wrapper_secp256k1',
      'auto',
    ])
    expect(
      listSelfAuthPreparedCallsSignaturePayloadModes({ parsedOwnerIndex: null, sessionKeyOwner: true }),
    ).toEqual(['inner_secp256k1', 'full_wrapper_secp256k1', 'auto'])
  })

  it('prepare capabilities omit paymasterService so Base App stays self-funded', () => {
    const caps = buildSelfFundedRelayPrepareCapabilities(18_871_666_861_048n, 2_400_000_000_000n)
    expect(caps).not.toHaveProperty('paymasterService')
    expect(caps.requiredFunds).toEqual([
      {
        address: '0x0000000000000000000000000000000000000000',
        value: '0x1358b225a3f8',
      },
    ])
  })
})

describe('submitSelfAuthRelayPart1SelfFunded', () => {
  beforeEach(() => {
    mockSubmitOwnerViaSendCalls.mockReset()
    mockSubmitOwnerViaSendCalls.mockRejectedValue(new Error('sendCalls unavailable in test'))
    mockBundlerRequest.mockReset()
    mockBundlerRequest.mockResolvedValue('0x' + 'bb'.repeat(32))
    mockGetUserOperationReceipt.mockReset()
    mockGetUserOperationReceipt.mockResolvedValue({
      paymaster: undefined,
      receipt: { transactionHash: '0x' + 'aa'.repeat(32) },
    })
  })

  it('cascades to prepare_calls when sendCalls fails and Base App returns a self-funded userOp', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: SAMPLE_USER_OP,
        }
      }
      if (args.method === 'personal_sign') {
        return '0x' + '22'.repeat(65)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return { id: 'prepared-self-funded' }
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: '0x' + 'aa'.repeat(32) }],
        }
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    const txHash = await submitSelfAuthRelayPart1SelfFunded({
      walletRequest,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '0'.repeat(128),
        value: '0x110dea8a3f8',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalledTimes(1)
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=send_calls_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
  })

  it('strips paymaster and uses wallet_sendPreparedCalls when Base App injects paymaster', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0xabc123' },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'personal_sign') {
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return { id: 'prepared-strip-self-funded' }
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: '0x' + 'ee'.repeat(32) }],
        }
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    const txHash = await submitSelfAuthRelayPart1SelfFunded({
      walletRequest,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '0'.repeat(128),
        value: '0x110dea8a3f8',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'ee'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendPreparedCalls' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_strip_paymaster_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:prepared_calls_signature_mode=inner_secp256k1')
  })

  it('uses prepared bundler when all wallet_sendPreparedCalls payload modes fail', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0xabc123' },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'personal_sign') {
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        throw new Error('Invalid UserOp signature or paymaster signature')
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    const txHash = await submitSelfAuthRelayPart1SelfFunded({
      walletRequest,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '0'.repeat(128),
        value: '0x110dea8a3f8',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'cc'.repeat(32))
    expect(mockBundlerRequest).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_strip_paymaster_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepared_bundler_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:prepared_bundler_tx=0x' + 'cc'.repeat(32))
  })

  it('surfaces prepared bundler failure for session-key owners', async () => {
    mockBundlerRequest.mockRejectedValue(new Error('prepared bundler rejected'))

    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0xabc123' },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'personal_sign') {
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        throw new Error('Invalid UserOp signature or paymaster signature')
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    await expect(
      submitSelfAuthRelayPart1SelfFunded({
        walletRequest,
        fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
        userCall: {
          to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
          data: '0x49290c1c' + '0'.repeat(128),
          value: '0x110dea8a3f8',
        },
        chainId: 8453,
        publicClient: mockPublicClient as never,
        appendEvent,
      }),
    ).rejects.toThrow(/prepared bundler rejected/)
  })

  it('does not cascade when prepare fails with Failed to fetch RPC request', async () => {
    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        throw new Error('An internal error was received. Details: Failed to fetch RPC request')
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    await expect(
      submitSelfAuthRelayPart1SelfFunded({
        walletRequest,
        fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
        userCall: {
          to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
          data: '0x49290c1c' + '0'.repeat(128),
          value: '0x110dea8a3f8',
        },
        chainId: 8453,
        publicClient: mockPublicClient as never,
        appendEvent,
      }),
    ).rejects.toThrow(/Failed to fetch RPC request/)
  })

  it('does not retry when personal_sign fails with error generating message', async () => {
    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0xabc123' },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'personal_sign') {
        throw new Error('error generating message')
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    await expect(
      submitSelfAuthRelayPart1SelfFunded({
        walletRequest,
        fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
        userCall: {
          to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
          data: '0x49290c1c' + '0'.repeat(128),
          value: '0x110dea8a3f8',
        },
        chainId: 8453,
        publicClient: mockPublicClient as never,
        appendEvent,
      }),
    ).rejects.toThrow(/error generating message/)
  })

  it('calls eth_requestAccounts before prepare on the primary lane', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: SAMPLE_USER_OP,
        }
      }
      if (args.method === 'personal_sign') {
        return '0x' + '22'.repeat(65)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return { id: 'prepared-self-funded-2' }
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: '0x' + 'ee'.repeat(32) }],
        }
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const appendEvent = vi.fn()
    const txHash = await submitSelfAuthRelayPart1SelfFunded({
      walletRequest,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '0'.repeat(128),
        value: '0x110dea8a3f8',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'ee'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_requestAccounts' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
  })
})
