/**
 * Tests for subAccountAddress.ts — deterministic salt + factory-backed
 * counterfactual address derivation.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  CSW_FACTORY_BASE,
  computeSubAccountAddress,
  computeSubAccountSalt,
} from '../../../server/_lib/wallet/subAccountAddress.js'

const PARENT = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const
const OWNER_EOA = '0xceca11111111111111111111111111111111185e' as const

describe('computeSubAccountSalt', () => {
  it('produces a deterministic 32-byte hex for the same inputs', () => {
    const a = computeSubAccountSalt({ profileId: 1, parentCsw: PARENT })
    const b = computeSubAccountSalt({ profileId: 1, parentCsw: PARENT })
    expect(a).toBe(b)
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('differs when profileId changes', () => {
    const a = computeSubAccountSalt({ profileId: 1, parentCsw: PARENT })
    const b = computeSubAccountSalt({ profileId: 2, parentCsw: PARENT })
    expect(a).not.toBe(b)
  })

  it('differs when parent CSW changes', () => {
    const a = computeSubAccountSalt({ profileId: 1, parentCsw: PARENT })
    const b = computeSubAccountSalt({
      profileId: 1,
      parentCsw: '0x0000000000000000000000000000000000000000' as const,
    })
    expect(a).not.toBe(b)
  })

  it('is case-insensitive in the parent address (lowercased)', () => {
    const lowered = computeSubAccountSalt({ profileId: 42, parentCsw: PARENT })
    const uppered = computeSubAccountSalt({
      profileId: 42,
      parentCsw: PARENT.toUpperCase() as typeof PARENT,
    })
    expect(lowered).toBe(uppered)
  })
})

describe('computeSubAccountAddress', () => {
  it('calls the factory getAddress view with (owners, nonce) and returns lowercased address', async () => {
    const readContract = vi.fn(async () => '0xABCDEF1234567890abcdef1234567890ABCDEF12')
    const publicClient = { readContract } as unknown as Parameters<
      typeof computeSubAccountAddress
    >[0]['publicClient']

    const result = await computeSubAccountAddress({
      publicClient,
      parentCsw: PARENT,
      ownerEoa: OWNER_EOA,
      profileId: 1,
    })
    expect(readContract).toHaveBeenCalledTimes(1)
    const call = (readContract.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>
    expect(call.address).toBe(CSW_FACTORY_BASE)
    expect(call.functionName).toBe('getAddress')
    const args = call.args as [string[], bigint]
    expect(args[0]).toHaveLength(2)
    expect(args[0][0]).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(args[0][1]).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(args[1]).toBe(BigInt(computeSubAccountSalt({ profileId: 1, parentCsw: PARENT })))

    expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
  })

  it('is deterministic: same inputs, same factory call, same output', async () => {
    const address = '0x1111111111111111111111111111111111111111'
    const readContract = vi.fn(async () => address)
    const publicClient = { readContract } as unknown as Parameters<
      typeof computeSubAccountAddress
    >[0]['publicClient']
    const a = await computeSubAccountAddress({ publicClient, parentCsw: PARENT, ownerEoa: OWNER_EOA, profileId: 7 })
    const b = await computeSubAccountAddress({ publicClient, parentCsw: PARENT, ownerEoa: OWNER_EOA, profileId: 7 })
    expect(a).toBe(b)
    // Same nonce used on both calls.
    const calls = readContract.mock.calls as unknown as unknown[][]
    const nonceA = (calls[0][0] as { args: [unknown, bigint] }).args[1]
    const nonceB = (calls[1][0] as { args: [unknown, bigint] }).args[1]
    expect(nonceA).toBe(nonceB)
  })
})
