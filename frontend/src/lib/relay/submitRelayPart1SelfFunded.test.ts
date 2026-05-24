import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, type Hex } from 'viem'

import {
  parseEntryPointPaymasterAddress,
  parseSelfAuthOwnerIndexFromSignature,
  parseWalletPreparedUserOpV06,
  readPreparedUserOpPaymasterAndData,
  buildSelfFundedRelayPrepareCapabilities,
  resolveSelfFundedSignHashAfterPaymasterStrip,
  listSelfAuthBundlerSignHashCandidates,
  listSelfAuthPreparedCallsSignaturePayloadModes,
  listSelfAuthPreparedCallsSignerAddressCandidates,
  stripRawWalletPreparedUserOp,
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
  getTransactionReceipt: vi.fn(async () => ({
    logs: [
      {
        address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        topics: [
          '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f',
          '0x' + '11'.repeat(32),
          '0x' + '00'.repeat(12) + '4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
          '0x' + '00'.repeat(32),
        ],
      },
    ],
  })),
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

const TEST_CUSTOM_OWNER_POLICY_TOKEN = 'test-relay-owner-install-policy-token'

function mockOwnerAtIndexEthCall() {
  return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
}

function mockPublicClientWithoutSessionKeyOwner() {
  mockPublicClient.readContract.mockImplementation(async (args: { functionName?: string }) => {
    if (args.functionName === 'ownerAtIndex') {
      throw new Error('no session key owner')
    }
    return 500_000_000_000_000n
  })
}

/** Default self-auth wallet mock: prepared-calls reject unless `preparedCallsAccept: true`. */
function createPreparedCallsWalletRequest(options?: {
  prepareUserOp?: Record<string, unknown>
  signatureRequestHash?: Hex
  signature?: Hex
  preparedCallsAccept?: boolean
}) {
  return vi.fn(async (args: { method: string; params?: unknown[] }) => {
    if (args.method === 'eth_requestAccounts') {
      return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
    }
    if (args.method === 'wallet_prepareCalls') {
      return {
        type: 'user-operation-v06',
        chainId: '0x2105',
        signatureRequest: { hash: options?.signatureRequestHash ?? ('0x' + '11'.repeat(32)) },
        userOp: options?.prepareUserOp ?? SAMPLE_USER_OP,
      }
    }
    if (args.method === 'personal_sign' || args.method === 'eth_sign' || args.method === 'eth_signTypedData_v4') {
      return options?.signature ?? wrapSelfAuthOwnerSignature(0)
    }
    if (args.method === 'eth_call') {
      return mockOwnerAtIndexEthCall()
    }
    if (args.method === 'wallet_sendPreparedCalls') {
      if (!options?.preparedCallsAccept) {
        throw new Error('Invalid UserOp signature or paymaster signature')
      }
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

  it('lists fallback hash candidates for session-key bundler submit', () => {
    const withPaymaster = {
      ...SAMPLE_USER_OP,
      paymasterAndData:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
    }
    const primary = resolveSelfFundedSignHashAfterPaymasterStrip({
      preparedUserOp: withPaymaster,
      signatureRequestHash: resolveSelfFundedSignHashAfterPaymasterStrip({
        preparedUserOp: withPaymaster,
        signatureRequestHash: '0x' + '00'.repeat(32),
        chainId: 8453,
      }).hash,
      chainId: 8453,
    })
    const candidates = listSelfAuthBundlerSignHashCandidates({
      preparedUserOp: withPaymaster,
      signatureRequestHash: primary.hash,
      chainId: 8453,
      preferSessionKeyNoChain: true,
    })
    expect(candidates.length).toBeGreaterThanOrEqual(1)
    expect(candidates[0]?.mode).toBe('entrypoint_v06_no_chain_session_key_primary')
  })

  it('parses owner index from Base App signature wrapper', () => {
    expect(parseSelfAuthOwnerIndexFromSignature(wrapSelfAuthOwnerSignature(2))).toBe(2)
    expect(parseSelfAuthOwnerIndexFromSignature(`0x${'22'.repeat(65)}`)).toBeNull()
  })

  it('orders prepared-calls signer address candidates for session-key recovery', () => {
    const candidates = listSelfAuthPreparedCallsSignerAddressCandidates({
      parsedOwnerAddress: SESSION_KEY_OWNER,
      recoveredEip191Address: '0x87bEB08622dc13c7259dc9c9DD41CDc9d89A2C9b',
      recoveredRawAddress: '0xa57C36026Fe64284Bc45904fbe72685d897032ce',
    })
    expect(candidates.map((candidate) => candidate.mode)).toEqual([
      'owner_at_index',
      'recovered_eip191',
      'recovered_raw',
    ])
  })

  it('session-key prepared-calls signers skip ecrecover guesses', () => {
    const candidates = listSelfAuthPreparedCallsSignerAddressCandidates({
      parsedOwnerAddress: SESSION_KEY_OWNER,
      recoveredEip191Address: '0x87bEB08622dc13c7259dc9c9DD41CDc9d89A2C9b',
      recoveredRawAddress: '0xa57C36026Fe64284Bc45904fbe72685d897032ce',
      sessionKeyOwner: true,
    })
    expect(candidates.map((candidate) => candidate.mode)).toEqual(['owner_at_index'])
  })

  it('uses full_wrapper_secp256k1 first for Base App session-key owner index 2', () => {
    expect(listSelfAuthPreparedCallsSignaturePayloadModes({ parsedOwnerIndex: 2 })).toEqual([
      'full_wrapper_secp256k1',
      'inner_secp256k1',
      'auto',
    ])
    expect(
      listSelfAuthPreparedCallsSignaturePayloadModes({ parsedOwnerIndex: null, sessionKeyOwner: true }),
    ).toEqual(['full_wrapper_secp256k1', 'inner_secp256k1', 'auto'])
  })

  it('prepare capabilities request optional paymaster and required native funds', () => {
    const caps = buildSelfFundedRelayPrepareCapabilities(18_871_666_861_048n, 2_400_000_000_000n)
    expect(caps.paymasterService).toEqual({ optional: true })
    expect(caps.requiredFunds).toEqual([
      {
        address: '0x0000000000000000000000000000000000000000',
        value: '0x1358b225a3f8',
      },
    ])
  })

  it('stripRawWalletPreparedUserOp clears snake_case paymaster fields', () => {
    const stripped = stripRawWalletPreparedUserOp({
      sender: SAMPLE_USER_OP.sender,
      paymaster_and_data:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
      signature: '0xdead',
    }) as Record<string, unknown>
    expect(stripped.paymasterAndData).toBe('0x')
    expect(stripped.paymaster_and_data).toBe('0x')
    expect(stripped.signature).toBe('0x')
  })
})

describe('submitSelfAuthRelayPart1SelfFunded', () => {
  beforeEach(() => {
    mockSubmitOwnerViaSendCalls.mockReset()
    mockSubmitOwnerViaSendCalls.mockRejectedValue(new Error('sendCalls unavailable in test'))
    mockPublicClient.readContract.mockReset()
    mockPublicClient.readContract.mockImplementation(async (args: { functionName?: string }) => {
      if (args.functionName === 'ownerAtIndex') {
        return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
      }
      return 500_000_000_000_000n
    })
    mockBundlerRequest.mockReset()
    mockBundlerRequest.mockImplementation(async (args: { method?: string }) => {
      if (args.method === 'eth_estimateUserOperationGas') {
        return {
          callGasLimit: '0x5208',
          verificationGasLimit: '0x5208',
          preVerificationGas: '0x5208',
        }
      }
      return '0x' + 'bb'.repeat(32)
    })
    mockGetUserOperationReceipt.mockReset()
    mockGetUserOperationReceipt.mockResolvedValue({
      paymaster: undefined,
      receipt: { transactionHash: '0x' + 'aa'.repeat(32) },
    })
    mockPublicClient.getTransactionReceipt.mockReset()
    mockPublicClient.getTransactionReceipt.mockResolvedValue({
      logs: [
        {
          address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
          topics: [
            '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f',
            '0x' + '11'.repeat(32),
            '0x' + '00'.repeat(12) + '4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
            '0x' + '00'.repeat(32),
          ],
        },
      ],
    })
  })

  it('requires custom-owner policy token before prepare lane', async () => {
    const walletRequest = vi.fn()
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
    ).rejects.toThrow(/sponsorship token/)
    expect(walletRequest).not.toHaveBeenCalled()
  })

  it('never uses wallet_sendCalls in self-auth owner-install', async () => {
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
      if (args.method === 'personal_sign' || args.method === 'eth_signTypedData_v4' || args.method === 'eth_sign') {
        return wrapSelfAuthOwnerSignature(2)
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
    await submitSelfAuthRelayPart1SelfFunded({
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
      customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
    })

    expect(mockSubmitOwnerViaSendCalls).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_send_calls_self_auth')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
    expect(walletRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
  })

  it('uses prepare_calls when self-auth skips sendCalls', async () => {
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
      if (args.method === 'personal_sign' || args.method === 'eth_signTypedData_v4' || args.method === 'eth_sign') {
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
      customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
    })

    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(mockSubmitOwnerViaSendCalls).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_send_calls_self_auth')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
  })

  it('strips paymaster and submits stripped prepared-calls when Base App injects paymaster', async () => {
    mockPublicClientWithoutSessionKeyOwner()

    const walletRequest = createPreparedCallsWalletRequest({
      preparedCallsAccept: true,
      signatureRequestHash: '0xabc123',
      prepareUserOp: {
        ...SAMPLE_USER_OP,
        paymasterAndData:
          '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
      },
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
      customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
    })

    expect(txHash).toBe('0x' + 'aa'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendPreparedCalls' }),
    )
    expect(mockBundlerRequest).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_prepare_native_paymaster_injected=1')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_strip_paymaster_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepared_calls_stripped_self_funded')
  })

  it('uses prepare-native mirror when prepare returns paymaster=0', async () => {
    mockPublicClientWithoutSessionKeyOwner()

    const walletRequest = createPreparedCallsWalletRequest({
      preparedCallsAccept: true,
      signatureRequestHash: '0xabc123',
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
      customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
    })

    expect(txHash).toBe('0x' + 'aa'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendPreparedCalls' }),
    )
    expect(mockBundlerRequest).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepared_calls_prepare_native')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:sign_mode=personal_sign_data_address')
  })

  it('surfaces prepared-calls failure when all payload modes fail', async () => {
    mockPublicClientWithoutSessionKeyOwner()

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
      if (args.method === 'personal_sign' || args.method === 'eth_sign' || args.method === 'eth_signTypedData_v4') {
        return wrapSelfAuthOwnerSignature(0)
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
        customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
      }),
    ).rejects.toThrow(/UserOp signature verification failed/)
    expect(mockBundlerRequest).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_prepare_native_paymaster_injected=1')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_bundler_self_auth=1')
  })

  it('rejects mistaken owner slot 3 signatures before prepared-calls submit', async () => {
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
      if (args.method === 'personal_sign' || args.method === 'eth_sign' || args.method === 'eth_signTypedData_v4') {
        return wrapSelfAuthOwnerSignature(3)
      }
      if (args.method === 'eth_call') {
        return mockOwnerAtIndexEthCall()
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
        customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
      }),
    ).rejects.toThrow(/mistaken owner in slot 3/)
    expect(mockBundlerRequest).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:reject_owner_index_3=1')
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
        customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
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
      if (args.method === 'personal_sign' || args.method === 'eth_sign' || args.method === 'eth_signTypedData_v4') {
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
        customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
      }),
    ).rejects.toThrow(/error generating message/)
  })

  it('calls eth_requestAccounts before prepare on the primary lane', async () => {
    mockPublicClientWithoutSessionKeyOwner()
    const walletRequest = createPreparedCallsWalletRequest({ preparedCallsAccept: true })

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
      customOwnerPolicyToken: TEST_CUSTOM_OWNER_POLICY_TOKEN,
    })

    expect(txHash).toBe('0x' + 'aa'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_requestAccounts' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_send_calls_self_auth')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
  })
})
