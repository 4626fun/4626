import { describe, expect, it, vi } from 'vitest'

import {
  parseEntryPointPaymasterAddress,
  readPreparedUserOpPaymasterAndData,
  submitSelfAuthRelayPart1SelfFunded,
  userOpHasPaymaster,
} from '@/lib/relay/submitRelayPart1SelfFunded'

vi.mock('@/lib/aa/coinbaseErc4337', () => ({
  sendCoinbaseSmartWalletUserOperation: vi.fn(),
}))

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
})

describe('submitSelfAuthRelayPart1SelfFunded', () => {
  it('uses prepare_calls lane when userOp has no paymaster', async () => {
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'wallet_prepareCalls') {
        return {
          type: 'user-operation-v06',
          chainId: '0x2105',
          signatureRequest: { hash: '0xabc123' },
          userOp: { paymasterAndData: '0x' },
        }
      }
      if (args.method === 'personal_sign') {
        return '0x' + '11'.repeat(65)
      }
      if (args.method === 'wallet_sendPreparedCalls') {
        return { id: 'bundle-1' }
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
    expect(walletRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_prepareCalls' }),
    )
    expect(walletRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_sendCalls' }),
    )
    expect(appendEvent).toHaveBeenCalledWith('relay_part1:prepared_userop_paymaster=0x0')
  })
})
