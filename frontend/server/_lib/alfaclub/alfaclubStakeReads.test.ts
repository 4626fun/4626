import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, keccak256, parseAbiParameters, type Address } from 'viem'

import {
  computeHostKeyShare,
  readUserStakedKeysFromStorage,
} from './alfaclubStakeReads.js'

const POOL = '0xCC9B82f066a028900c3138b75d010A7DeF72f509' as Address
const USER = '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9' as Address
const VALUES_MAP_SLOT = 16n

function valuesArrayHead(user: Address): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, uint256'), [user, VALUES_MAP_SLOT]),
  )
}

describe('readUserStakedKeysFromStorage', () => {
  it('sums Stake[] entries for a user from FriendStake storage layout', async () => {
    const head = valuesArrayHead(USER)
    const base = BigInt(keccak256(head))
    const storage = new Map<string, bigint>([
      [head, 1n],
      [`0x${(base + 0n).toString(16).padStart(64, '0')}`, 30n],
      [`0x${(base + 1n).toString(16).padStart(64, '0')}`, 1_782_668_791n],
    ])

    const client = {
      getLogs: async () => [],
      readContract: async () => 0n,
      getStorageAt: async ({ slot }: { slot: `0x${string}` }) =>
        `0x${(storage.get(slot.toLowerCase()) ?? 0n).toString(16).padStart(64, '0')}` as `0x${string}`,
    }

    await expect(readUserStakedKeysFromStorage(client, POOL, USER)).resolves.toBe(30n)
  })

  it('returns 0 when the user has no stake entries', async () => {
    const head = valuesArrayHead(USER)
    const client = {
      getLogs: async () => [],
      readContract: async () => 0n,
      getStorageAt: async () =>
        '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    }

    await expect(readUserStakedKeysFromStorage(client, POOL, USER)).resolves.toBe(0n)
    expect(head).toMatch(/^0x/)
  })
})

describe('computeHostKeyShare (stake reads)', () => {
  it('includes staked-only owner keys in ownership share', () => {
    expect(
      computeHostKeyShare({
        keySupply: 84,
        hostWalletKeys: 0,
        hostStakedKeys: 11,
      }),
    ).toEqual({
      hostKeys: 11,
      hostSharePercent: 13,
      stakeRatioPercent: 13,
    })
  })
})

describe('net stake from event totals', () => {
  it('matches Flip Trades creator history (12 + 11 - 12 = 11)', () => {
    const staked = 12n + 11n
    const unstaked = 12n
    const net = staked >= unstaked ? staked - unstaked : 0n
    expect(Number(net)).toBe(11)
  })
})
