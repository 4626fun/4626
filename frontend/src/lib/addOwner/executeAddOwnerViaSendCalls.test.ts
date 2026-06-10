import { describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import { executeAddOwnerViaSendCalls } from './executeAddOwnerViaSendCalls.js'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const CSW = getAddress(CANONICAL_CSW_ADDRESS)
const OWNER = '0xB2aaD65A5402714bf428a66731ae62BA5c45CAC0' as const

describe('executeAddOwnerViaSendCalls', () => {
  it('submits addOwnerAddress self-call via wallet_sendCalls v2.0.0', async () => {
    const events: string[] = []
    const walletRequest = vi.fn(async (args: { method: string; params?: unknown[] }) => {
      if (args.method === 'eth_requestAccounts') return [CSW]
      if (args.method === 'wallet_sendCalls') {
        const payload = (args.params?.[0] ?? {}) as Record<string, unknown>
        expect(payload.version).toBe('2.0.0')
        expect(payload.from).toBe(CSW)
        expect(payload.chainId).toBe('0x2105')
        const calls = payload.calls as Array<{ to: string; data: string; value: string }>
        expect(calls[0]?.to).toBe(CSW)
        expect(calls[0]?.data.startsWith('0x0f0f3f24')).toBe(true)
        return { id: 'bundle-direct-1' }
      }
      if (args.method === 'wallet_getCallsStatus') {
        return {
          status: 200,
          receipts: [{ transactionHash: `0x${'aa'.repeat(32)}` }],
        }
      }
      throw new Error(`unexpected method ${args.method}`)
    })

    const result = await executeAddOwnerViaSendCalls({
      cswAddress: CSW,
      ownerToAdd: OWNER,
      publicClient: undefined,
      walletRequest,
      appendEvent: (row) => events.push(row),
    })

    expect(result.txHash).toBe(`0x${'aa'.repeat(32)}`)
    expect(events.some((row) => row.includes('direct_add_owner:wallet_sendCalls=start'))).toBe(true)
  })

  it('tags Base App style blockers for Relay fallback', async () => {
    const walletRequest = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_requestAccounts') return [CSW]
      if (args.method === 'wallet_sendCalls') {
        throw new Error('Error generating transaction — make sure you have enough funds')
      }
      return []
    })

    await expect(
      executeAddOwnerViaSendCalls({
        cswAddress: CSW,
        ownerToAdd: OWNER,
        publicClient: undefined,
        walletRequest,
        appendEvent: () => {},
      }),
    ).rejects.toThrow(/direct_add_owner_blocked/)
  })
})
