import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, type Hex } from 'viem'
import { entryPoint06Address, getUserOperationHash } from 'viem/account-abstraction'

import * as submitRelayPart1SelfFundedModule from '@/lib/relay/submitRelayPart1SelfFunded'
import {
  parseEntryPointPaymasterAddress,
  parseSelfAuthOwnerIndexFromSignature,
  parseWalletPreparedUserOpV06,
  readPreparedUserOpPaymasterAndData,
  buildSelfFundedRelayPrepareCapabilities,
  computeSelfAuthReplaySafeHash,
  resolveSelfFundedSignHashAfterPaymasterStrip,
  listSelfAuthBundlerSignHashCandidates,
  listSelfAuthPreparedCallsSignaturePayloadModes,
  listSelfAuthPreparedCallsSignerAddressCandidates,
  listSelfAuthSignMethods,
  isSelfAuthPasskeyOwnerSignature,
  isSelfAuthReplaySafeSignHashMode,
  isSelfAuthSessionKeyEcdsaSignature,
  shouldRejectSelfAuthSignatureForSessionKeyLane,
  stripRawWalletPreparedUserOp,
  stripUserOpPaymaster,
  submitSelfAuthRelayPart1SelfFunded,
  userOpHasPaymaster,
} from '@/lib/relay/submitRelayPart1SelfFunded'
import { unwrapDoubleHexEncodedHash } from '@/lib/wallet/onboardingWalletReplayable'

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
    if (args.functionName === 'isValidSignature') {
      return '0x1626ba7e'
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
    if (args.functionName === 'isValidSignature') {
      return '0x1626ba7e'
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

  it('lists entrypoint hash before replaySafe for session-key lane', () => {
    expect(isSelfAuthReplaySafeSignHashMode('csw_replay_safe_primary')).toBe(true)
    expect(isSelfAuthReplaySafeSignHashMode('entrypoint_v06_chain')).toBe(false)
    const withPaymaster = {
      ...SAMPLE_USER_OP,
      paymasterAndData:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
    }
    const stripped = stripUserOpPaymaster(parseWalletPreparedUserOpV06(withPaymaster))
    const entryPointHash = getUserOperationHash({
      chainId: 8453,
      entryPointAddress: entryPoint06Address,
      entryPointVersion: '0.6',
      userOperation: {
        sender: stripped.sender,
        nonce: stripped.nonce,
        initCode: stripped.initCode,
        callData: stripped.callData,
        callGasLimit: stripped.callGasLimit,
        verificationGasLimit: stripped.verificationGasLimit,
        preVerificationGas: stripped.preVerificationGas,
        maxFeePerGas: stripped.maxFeePerGas,
        maxPriorityFeePerGas: stripped.maxPriorityFeePerGas,
        paymasterAndData: stripped.paymasterAndData,
        signature: stripped.signature,
      },
    })
    const replaySafe = computeSelfAuthReplaySafeHash({
      fundingCsw: SAMPLE_USER_OP.sender,
      chainId: 8453,
      userOpHash: entryPointHash,
    })
    expect(replaySafe).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(replaySafe).not.toBe(entryPointHash)
    const candidates = listSelfAuthBundlerSignHashCandidates({
      preparedUserOp: withPaymaster,
      signatureRequestHash: entryPointHash,
      chainId: 8453,
      sessionKeyOwner: true,
      fundingCsw: SAMPLE_USER_OP.sender,
    })
    expect(candidates[0]?.mode).toMatch(/entrypoint_v06.*session_key/)
    expect(candidates.some((candidate) => candidate.mode === 'csw_replay_safe_sdk_fallback')).toBe(true)
  })

  it('lists domain-matched stripped hash before no-chain fallback', () => {
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
      fundingCsw: SAMPLE_USER_OP.sender,
      preferReplaySafeHash: true,
    })
    expect(candidates.length).toBeGreaterThanOrEqual(1)
    expect(candidates[0]?.mode).toBe('csw_replay_safe_primary')
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

  it('session-key prepared-calls signers use ownerAtIndex not substituted EOAs', () => {
    const candidates = listSelfAuthPreparedCallsSignerAddressCandidates({
      parsedOwnerAddress: SESSION_KEY_OWNER,
      recoveredEip191Address: '0x87bEB08622dc13c7259dc9c9DD41CDc9d89A2C9b',
      recoveredRawAddress: '0xa57C36026Fe64284Bc45904fbe72685d897032ce',
      resolvedOwnerAtIndexAddress: SESSION_KEY_OWNER,
      sessionKeyOwner: true,
    })
    expect(candidates.map((candidate) => candidate.mode)).toEqual(['owner_at_index_resolved'])
  })

  it('session-key prepared-calls signers include funding CSW fallback', () => {
    const candidates = listSelfAuthPreparedCallsSignerAddressCandidates({
      parsedOwnerAddress: SESSION_KEY_OWNER,
      fundingCsw: SAMPLE_USER_OP.sender,
      sessionKeyOwner: true,
    })
    expect(candidates.map((candidate) => candidate.mode)).toEqual([
      'owner_at_index',
      'funding_csw_session_key',
    ])
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

  it('prepare capabilities request required native funds only (no paymaster hint)', () => {
    const caps = buildSelfFundedRelayPrepareCapabilities(18_871_666_861_048n, 2_400_000_000_000n)
    expect(caps.paymasterService).toBeUndefined()
    expect(caps.requiredFunds).toEqual([
      {
        address: '0x0000000000000000000000000000000000000000',
        value: '0x1358b225a3f8',
      },
    ])
  })

  it('resolves 4626.base.eth double-encoded prepare hash to entrypoint_v06_chain stripped digest', () => {
    const userOp = {
      sender: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
      nonce: '0xa2',
      initCode: '0x',
      callData:
        '0x34fcd5be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004cd00e387622c35bddb9b4c962c136462338bc31000000000000000000000000000000000000000000000000000ab49cfb5a3f000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000004449290c1c0000000000000000000000004beabd0afbcc2f0440cdef1c3c745d43fae704efa0d6076b65c7e73da11bd76cb32c250572e41ac715176971c4b1c554ce036e8400000000000000000000000000000000000000000000000000000000',
      callGasLimit: '0x4bb8',
      verificationGasLimit: '0x16fcf',
      preVerificationGas: '0x1cffa',
      maxFeePerGas: '0x8c51e0',
      maxPriorityFeePerGas: '0x16e360',
      paymasterAndData:
        '0x2faeb0760d4230ef2ac21496bb4f0b47d634fd4c00006a132502000000000000e8a7bee5b39b423e9123132896077745000100833589fcd6edb6e08f4c7c32d4f71b54bda0291328da22dcc90c4d9f4caee6d0bfe11aec413ef609000000000000000000000000000000000000000000000000000000003e72d2f40000006978409b8a037cf26c9ef30572ffc772d2fd8af7697630afc65d8e70ee0d2dcd566c7002dd2fded8b8940c26cc67ab06ed4a347bfe3b182f3d61e25b915919db5eca1c',
      signature: '0x',
    }
    const doubleEncodedHash =
      '0x307836636633643632656437376462336532646663623932346438393464636335626463386366653637303439383964386235356364303133376264393439613930' as Hex

    const unwrapped = unwrapDoubleHexEncodedHash(doubleEncodedHash)
    expect(unwrapped).toBe('0x6cf3d62ed77db3e2dfcb924d894dcc5bdc8cfe6704989d8b55cd0137bd949a90')

    const parsed = parseWalletPreparedUserOpV06(userOp)
    const primary = resolveSelfFundedSignHashAfterPaymasterStrip({
      preparedUserOp: userOp,
      signatureRequestHash: doubleEncodedHash,
      chainId: 8453,
    })
    // Base App may use a prepare-local hash domain; unmatched still yields stripped with-chain digest.
    expect(['entrypoint_v06_chain', 'entrypoint_v06_chain_unmatched_prepare_hash']).toContain(primary.mode)
    expect(stripUserOpPaymaster(parsed).paymasterAndData).toBe('0x')

    const candidates = listSelfAuthBundlerSignHashCandidates({
      preparedUserOp: userOp,
      signatureRequestHash: doubleEncodedHash,
      chainId: 8453,
      sessionKeyOwner: true,
      fundingCsw: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
      preferReplaySafeHash: true,
    })
    expect(candidates[0]?.mode).toMatch(/entrypoint_v06.*session_key/)
    expect(candidates.some((candidate) => candidate.mode === 'csw_replay_safe_sdk_fallback')).toBe(
      true,
    )
  })

  it('prioritizes stripped with-chain hash for session-key paymaster strip when prepare hash matches', () => {
    const withPaymaster = {
      ...SAMPLE_USER_OP,
      paymasterAndData:
        '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
    }
    const parsed = parseWalletPreparedUserOpV06(withPaymaster)
    const matchedPrepareHash = getUserOperationHash({
      chainId: 8453,
      entryPointAddress: entryPoint06Address,
      entryPointVersion: '0.6',
      userOperation: {
        sender: parsed.sender,
        nonce: parsed.nonce,
        initCode: parsed.initCode,
        callData: parsed.callData,
        callGasLimit: parsed.callGasLimit,
        verificationGasLimit: parsed.verificationGasLimit,
        preVerificationGas: parsed.preVerificationGas,
        maxFeePerGas: parsed.maxFeePerGas,
        maxPriorityFeePerGas: parsed.maxPriorityFeePerGas,
        paymasterAndData: parsed.paymasterAndData,
        signature: parsed.signature,
      },
    })
    const candidates = listSelfAuthBundlerSignHashCandidates({
      preparedUserOp: withPaymaster,
      signatureRequestHash: matchedPrepareHash,
      chainId: 8453,
      sessionKeyOwner: true,
      fundingCsw: SAMPLE_USER_OP.sender,
      preferReplaySafeHash: true,
    })
    expect(candidates[0]?.mode).toBe('entrypoint_v06_chain_session_key_primary')
    expect(candidates.some((candidate) => candidate.mode === 'csw_replay_safe_sdk_fallback')).toBe(
      true,
    )
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
  const validateUserOpPreflightSpy = vi.spyOn(
    submitRelayPart1SelfFundedModule,
    'preflightValidateUserOpStyleSignature',
  )

  beforeEach(() => {
    validateUserOpPreflightSpy.mockResolvedValue(true)
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
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepared_calls_stripped_self_funded_fallback')
  })

  it('does not fall back to wallet_sendCalls when paymaster strip signing is unauthorized', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'personal_sign' || args.method === 'eth_sign') {
        throw new Error("Must call 'eth_requestAccounts' before other methods")
      }
      if (args.method === 'wallet_sendCalls') {
        throw new Error('wallet_sendCalls must not run in self-auth Part 1')
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
    ).rejects.toThrow(/did not authorize the Relay deposit signature|USDC paymaster on prepare/)

    expect(mockSubmitOwnerViaSendCalls).not.toHaveBeenCalled()
    expect(walletRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
  })

  it('session-key replay-safe hash prefers typed_data_v4 (sukanto), entrypoint hash uses personal_sign', () => {
    expect(
      listSelfAuthSignMethods({
        sessionKeyOwner: true,
        parsedOwnerIndex: 2,
        bundlerOnly: true,
        hashMode: 'csw_replay_safe_primary',
      }),
    ).toEqual(['typed_data_v4_csw'])
    expect(
      listSelfAuthSignMethods({
        sessionKeyOwner: true,
        parsedOwnerIndex: 2,
        bundlerOnly: true,
        hashMode: 'csw_replay_safe_primary',
        sessionKeySignerAddress: SESSION_KEY_OWNER,
      }),
    ).toEqual(['typed_data_v4_csw'])
    expect(
      listSelfAuthSignMethods({
        sessionKeyOwner: true,
        parsedOwnerIndex: 2,
        bundlerOnly: true,
        hashMode: 'entrypoint_v06_chain_session_key_primary',
      }),
    ).toEqual(['personal_sign_data_address', 'personal_sign_address_data', 'eth_sign_address_data'])
  })

  it('detects passkey vs session-key ECDSA signatures', () => {
    expect(isSelfAuthSessionKeyEcdsaSignature(wrapSelfAuthOwnerSignature(2))).toBe(true)
    expect(isSelfAuthSessionKeyEcdsaSignature(wrapSelfAuthOwnerSignature(0))).toBe(false)
    const passkeyLike = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [0n, `0x${'ab'.repeat(200)}` as Hex],
    ) as Hex
    expect(isSelfAuthPasskeyOwnerSignature(passkeyLike)).toBe(true)
    expect(
      shouldRejectSelfAuthSignatureForSessionKeyLane({
        sessionKeyOwner: true,
        signature: passkeyLike,
        parsedOwnerIndex: 0,
      }),
    ).toBe(true)
  })

  it('session-key Part 1 tries entrypoint hash before replaySafe after paymaster strip', async () => {
    mockPublicClient.readContract.mockImplementation(async (args: { functionName?: string }) => {
      if (args.functionName === 'ownerAtIndex') {
        return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
      }
      if (args.functionName === 'isValidSignature') {
        return '0x1626ba7e'
      }
      return 500_000_000_000_000n
    })

    const signMethods: string[] = []
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData:
              '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c0000000000000000000000000000000000000000000000000000000000000064',
          },
        }
      }
      if (args.method === 'eth_signTypedData_v4') {
        signMethods.push(args.method)
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'personal_sign') {
        signMethods.push(args.method)
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'eth_sign') {
        throw new Error('The requested method is not supported by this Ethereum provider.')
      }
      if (args.method === 'eth_call') {
        return mockOwnerAtIndexEthCall()
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
    expect(signMethods).toContain('personal_sign')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:preflight_session_key_owner=1')
    expect(appendEvent).toHaveBeenCalledWith(
      expect.stringMatching(/relay_part1:sign_hash_mode=entrypoint_v06.*session_key/),
    )
  })

  it('rejects passkey signatures in session-key Part 1 lane', async () => {
    mockPublicClient.readContract.mockImplementation(async (args: { functionName?: string }) => {
      if (args.functionName === 'ownerAtIndex') {
        return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
      }
      if (args.functionName === 'isValidSignature') {
        return '0xffffffff'
      }
      return 500_000_000_000_000n
    })

    const passkeyLike = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      [0n, `0x${'ab'.repeat(200)}` as Hex],
    ) as Hex

    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData: '0x',
          },
        }
      }
      if (args.method === 'personal_sign' || args.method === 'eth_signTypedData_v4') {
        return passkeyLike
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
    ).rejects.toThrow(/passkey \(owner slot 0\)/)

    expect(appendEvent).toHaveBeenCalledWith('relay_part1:reject_passkey_sig_session_key_lane=1')
    expect(walletRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendPreparedCalls' }),
    )
  })

  it('skips prepared-calls when replaySafe sig fails validateUserOp preflight', async () => {
    validateUserOpPreflightSpy.mockResolvedValue(false)
    mockBundlerRequest.mockImplementation(async (args: { method?: string }) => {
      if (args.method === 'eth_estimateUserOperationGas') {
        return {
          callGasLimit: '0x5208',
          verificationGasLimit: '0x5208',
          preVerificationGas: '0x5208',
        }
      }
      throw new Error('Invalid UserOp signature or paymaster signature')
    })
    mockPublicClient.readContract.mockImplementation(async (args: { functionName?: string }) => {
      if (args.functionName === 'ownerAtIndex') {
        return encodeAbiParameters([{ type: 'address' }], [SESSION_KEY_OWNER])
      }
      if (args.functionName === 'ownerCount') {
        return 4n
      }
      if (args.functionName === 'isValidSignature') {
        return '0xffffffff'
      }
      return 500_000_000_000_000n
    })

    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: {
            ...SAMPLE_USER_OP,
            paymasterAndData: '0x',
          },
        }
      }
      if (args.method === 'eth_signTypedData_v4') {
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'personal_sign') {
        return wrapSelfAuthOwnerSignature(2)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        throw new Error('failed to get packed signature: invalid request: signature.data.address = no matching signer found for account')
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: '0x' + 'cc'.repeat(32) }],
        }
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
    ).rejects.toThrow(/Could not submit the Relay deposit UserOp|signature verification failed|Invalid UserOp signature/i)

    expect(appendEvent).toHaveBeenCalledWith(
      'relay_part1:skip_prepared_calls_replay_safe_validate_user_op_mismatch=1',
    )
    expect(appendEvent).toHaveBeenCalledWith(
      expect.stringContaining('relay_part1:session_key_bundler_despite_validate_user_op_preflight=1'),
    )
    expect(appendEvent).toHaveBeenCalledWith(
      expect.stringContaining('relay_part1:onchain_sig_preflight=advisory_invalid_session_key'),
    )
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

  it('falls back to bundler when prepared-calls reject all payload modes', async () => {
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
    expect(mockBundlerRequest).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:skip_prepare_native_paymaster_injected=1')
    const bundlerLaneEvents = appendEvent.mock.calls
      .map((call) => call[0])
      .filter(
        (event) =>
          event === 'relay_part1:lane=prepared_bundler_self_funded' ||
          event === 'relay_part1:lane=prepared_bundler_self_funded_fallback',
      )
    expect(bundlerLaneEvents.length).toBeGreaterThan(0)
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
    ).rejects.toThrow(/USDC paymaster on prepare|error generating message/)
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
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_self_funded')
  })
})
