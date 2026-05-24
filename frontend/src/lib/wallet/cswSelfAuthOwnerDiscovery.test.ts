import { describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters } from 'viem'

import {
  BASE_APP_SESSION_KEY_OWNER_INDEX,
  discoverSelfAuthOwnerFromChain,
  mergeSelfAuthOwnerDiscovery,
} from '@/lib/wallet/cswSelfAuthOwnerDiscovery'

const SESSION_KEY = '0xCf8D17Ce01B73637ef936fe7c47bA7100b820142' as const
const CSW = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const

function eoaOwnerBytes(address: `0x${string}`) {
  return encodeAbiParameters([{ type: 'address' }], [address])
}

function passkeyOwnerBytes() {
  return `0x${'ab'.repeat(64)}` as `0x${string}`
}

describe('discoverSelfAuthOwnerFromChain', () => {
  it('detects passkey-first session-key CSW from owner slots', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { functionName: string; args?: unknown[] }) => {
        if (args.functionName === 'ownerCount') return 3n
        const index = Number((args.args as [bigint] | undefined)?.[0] ?? -1)
        if (index === 0) return passkeyOwnerBytes()
        if (index === BASE_APP_SESSION_KEY_OWNER_INDEX) return eoaOwnerBytes(SESSION_KEY)
        return '0x' + '00'.repeat(32)
      }),
    }

    const seed = await discoverSelfAuthOwnerFromChain({
      publicClient: publicClient as never,
      fundingCsw: CSW,
      requirePasskeyAtZero: true,
    })

    expect(seed.passkeyFirst).toBe(true)
    expect(seed.sessionKeyOwner).toBe(true)
    expect(seed.ownerIndex).toBe(BASE_APP_SESSION_KEY_OWNER_INDEX)
    expect(seed.ownerSignerAddress?.toLowerCase()).toBe(SESSION_KEY.toLowerCase())
  })

  it('returns empty when owner[0] is not passkey and requirePasskeyAtZero is set', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { functionName: string; args?: unknown[] }) => {
        if (args.functionName === 'ownerCount') return 3n
        const index = Number((args.args as [bigint] | undefined)?.[0] ?? -1)
        if (index === 0) return eoaOwnerBytes('0x1111111111111111111111111111111111111111')
        if (index === BASE_APP_SESSION_KEY_OWNER_INDEX) return eoaOwnerBytes(SESSION_KEY)
        return '0x' + '00'.repeat(32)
      }),
    }

    const seed = await discoverSelfAuthOwnerFromChain({
      publicClient: publicClient as never,
      fundingCsw: CSW,
      requirePasskeyAtZero: true,
    })

    expect(seed.sessionKeyOwner).toBe(false)
    expect(seed.passkeyFirst).toBe(false)
  })
})

describe('mergeSelfAuthOwnerDiscovery', () => {
  it('preserves chain seed and overlays runtime discovery', () => {
    const merged = mergeSelfAuthOwnerDiscovery(
      {
        ownerIndex: 2,
        ownerSignerAddress: SESSION_KEY,
        sessionKeyOwner: true,
        passkeyFirst: true,
      },
      { ownerIndex: 2, sessionKeyOwner: true },
    )
    expect(merged.ownerSignerAddress).toBe(SESSION_KEY)
    expect(merged.sessionKeyOwner).toBe(true)
    expect(merged.passkeyFirst).toBe(true)
  })
})
