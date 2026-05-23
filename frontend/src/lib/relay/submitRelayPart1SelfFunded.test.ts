import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import {
  parseEntryPointPaymasterAddress,
  parseWalletPreparedUserOpV06,
  readPreparedUserOpPaymasterAndData,
  resolveSelfFundedSignHashAfterPaymasterStrip,
  stripUserOpPaymaster,
  submitSelfAuthRelayPart1SelfFunded,
  userOpHasPaymaster,
} from '@/lib/relay/submitRelayPart1SelfFunded'
import { buildCswUserOpTypedDataPayload } from '@/lib/wallet/onboardingWalletPrepared'

vi.mock('@/lib/aa/coinbaseErc4337', () => ({
  sendCoinbaseSmartWalletUserOperation: vi.fn(),
}))

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

const mockSubmitOwnerViaSendCalls = vi.fn()

vi.mock('@/lib/wallet/cswSendCalls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/cswSendCalls')>()
  return {
    ...actual,
    _submitOwnerViaSendCalls: (...args: unknown[]) => mockSubmitOwnerViaSendCalls(...args),
  }
})

const mockPublicClient = {
  getBalance: vi.fn(async () => 10_000_000_000_000_000n),
  readContract: vi.fn(async () => 500_000_000_000_000n),
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

  it('builds Coinbase Smart Wallet typed data for UserOp hash signing', () => {
    const payload = buildCswUserOpTypedDataPayload({
      smartWallet: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      chainId: 8453,
      userOpHash: '0x' + 'ab'.repeat(32),
    })
    expect(payload.primaryType).toBe('CoinbaseSmartWalletMessage')
    expect(payload.domain.name).toBe('Coinbase Smart Wallet')
    expect(payload.domain.chainId).toBe(8453)
    expect(payload.message.hash).toBe('0x' + 'ab'.repeat(32))
  })
})

describe('submitSelfAuthRelayPart1SelfFunded', () => {
  beforeEach(() => {
    mockSubmitOwnerViaSendCalls.mockReset()
    mockGetUserOperationReceipt.mockReset()
    mockGetUserOperationReceipt.mockResolvedValue({
      paymaster: undefined,
      receipt: { transactionHash: '0x' + 'aa'.repeat(32) },
    })
  })

  it('uses send_calls lane first when wallet_sendCalls succeeds (May 12 golden path)', async () => {
    mockSubmitOwnerViaSendCalls.mockResolvedValue({ callBundleId: 'bundle-send-1' })

    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
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
        value: '0x1122334455667788',
      },
      chainId: 8453,
      appendEvent,
    })

    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalled()
    expect(walletRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=send_calls_self_funded')
  })

  it('falls back when sendCalls lands with a paymaster-sponsored UserOp', async () => {
    vi.mocked(sendCoinbaseSmartWalletUserOperation).mockResolvedValue({
      transactionHash: '0x' + 'dd'.repeat(32),
      userOperationHash: '0x' + 'bb'.repeat(32),
    } as Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>>)

    mockGetUserOperationReceipt.mockResolvedValue({
      paymaster: '0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c',
      receipt: { transactionHash: '0x' + 'aa'.repeat(32) },
    })

    mockSubmitOwnerViaSendCalls.mockResolvedValue({ callBundleId: 'bundle-paymaster' })

    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
      }
      if (args.method === 'wallet_getCallsStatus') {
        const params = (args as { params?: unknown[] }).params
        const id = params?.[0] as { id?: string } | undefined
        if (id?.id === 'prepared-after-paymaster-reject') {
          return {
            status: 200,
            receipts: [{ transactionHash: '0x' + 'cc'.repeat(32) }],
          }
        }
        return {
          status: 200,
          receipts: [
            {
              transactionHash: '0x' + 'aa'.repeat(32),
              userOperationHash: '0x' + 'bb'.repeat(32),
            },
          ],
        }
      }
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0x' + '11'.repeat(32) },
          userOp: SAMPLE_USER_OP,
        }
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return { id: 'prepared-after-paymaster-reject' }
      }
      if (args.method === 'personal_sign') {
        return '0x' + '22'.repeat(65)
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
        value: '18871666861048',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith(
      'relay_part1:landed_userop_paymaster=0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c',
    )
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
    expect(sendCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('falls back to prepare+bundler when sendCalls fails and prepare injects paymaster', async () => {
    vi.mocked(sendCoinbaseSmartWalletUserOperation).mockResolvedValue({
      transactionHash: '0x' + 'cc'.repeat(32),
      userOperationHash: '0x' + 'bb'.repeat(32),
    } as Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>>)

    mockSubmitOwnerViaSendCalls.mockRejectedValue(new Error('sendCalls unavailable'))

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
        throw new Error('personal_sign blocked in test')
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
        value: '18871666861048',
      },
      chainId: 8453,
      publicClient: mockPublicClient as never,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'cc'.repeat(32))
    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperation).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=send_calls_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_strip_paymaster_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=bundler_self_funded')
  })

  it('throws strip error when sendCalls, strip, and bundler all fail', async () => {
    vi.mocked(sendCoinbaseSmartWalletUserOperation).mockRejectedValue(new Error('bundler rejected'))

    mockSubmitOwnerViaSendCalls.mockRejectedValue(new Error('sendCalls unavailable'))

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
          value: '18871666861048',
        },
        chainId: 8453,
        publicClient: mockPublicClient as never,
        appendEvent,
      }),
    ).rejects.toThrow(/bundler rejected/)
    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperation).toHaveBeenCalled()
  })

  it('strips injected paymaster via prepare fallback when sendCalls fails and bundler is unavailable', async () => {
    mockSubmitOwnerViaSendCalls.mockRejectedValue(new Error('sendCalls unavailable'))

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
        return '0x' + '22'.repeat(130)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        const payload = args.params?.[0] as { data?: { paymasterAndData?: string } }
        expect(payload?.data?.paymasterAndData).toBe('0x')
        return { id: 'bundle-2' }
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
    const txHash = await submitSelfAuthRelayPart1SelfFunded({
      walletRequest,
      fundingCsw: '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF',
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '0'.repeat(128),
        value: '18871666861048',
      },
      chainId: 8453,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'cc'.repeat(32))
    expect(mockSubmitOwnerViaSendCalls).toHaveBeenCalled()
    expect(sendCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=send_calls_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=prepare_calls_strip_paymaster_self_funded')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:sign_mode=personal_sign_data_address')
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:prepared_userop_paymaster=0x0')
  })

  it('calls eth_requestAccounts before send_calls on the primary lane', async () => {
    mockSubmitOwnerViaSendCalls.mockResolvedValue({ callBundleId: 'bundle-send-2' })

    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') {
        return ['0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF']
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
        value: '18871666861048',
      },
      chainId: 8453,
      appendEvent,
    })

    expect(txHash).toBe('0x' + 'ee'.repeat(32))
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_requestAccounts' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:lane=send_calls_self_funded')
  })
})
