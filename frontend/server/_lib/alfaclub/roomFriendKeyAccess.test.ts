import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveAuthorizedWalletProfileMock } = vi.hoisted(() => ({
  resolveAuthorizedWalletProfileMock: vi.fn(async (): Promise<{
    canonicalSmartWalletAddress: `0x${string}` | null
    activeOwnerWalletAddress: `0x${string}` | null
  } | null> => null),
}))

vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

import {
  expandFriendKeyCheckWallets,
  resolveRoomFriendKeyAccess,
  walletHoldsOrStakesRoomFriendKey,
} from './roomFriendKeyAccess.js'

beforeEach(() => {
  resolveAuthorizedWalletProfileMock.mockReset()
  resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
})

describe('resolveRoomFriendKeyAccess', () => {
  it('treats all-null RPC reads as check_failed, not insufficient', async () => {
    const access = await resolveRoomFriendKeyAccess({
      roomId: '1659',
      wallets: [`0x${'aa'.repeat(20)}`],
      dependencies: {
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => null,
        readWalletStakedKeys: async () => null,
      },
    })

    expect(access).toEqual({
      allowed: false,
      reason: 'check_failed',
      walletAddress: `0x${'aa'.repeat(20)}`,
    })
  })

  it('returns insufficient only after conclusive zero balance and stake reads', async () => {
    const access = await resolveRoomFriendKeyAccess({
      roomId: '1659',
      wallets: [`0x${'bb'.repeat(20)}`],
      dependencies: {
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => 0n,
        readWalletStakedKeys: async () => 0,
      },
    })

    expect(access).toEqual({
      allowed: false,
      reason: 'insufficient',
      walletAddress: `0x${'bb'.repeat(20)}`,
    })
  })

  it('treats zero balance with inconclusive stake as check_failed', async () => {
    const access = await resolveRoomFriendKeyAccess({
      roomId: '1659',
      wallets: [`0x${'cc'.repeat(20)}`],
      dependencies: {
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => 0n,
        readWalletStakedKeys: async () => null,
      },
    })

    expect(access).toEqual({
      allowed: false,
      reason: 'check_failed',
      walletAddress: `0x${'cc'.repeat(20)}`,
    })
  })

  it('allows when any wallet holds or stakes the room key', async () => {
    const readWalletKeyBalance = vi
      .fn()
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(1n)

    const access = await resolveRoomFriendKeyAccess({
      roomId: '1659',
      wallets: [`0x${'aa'.repeat(20)}`, `0x${'bb'.repeat(20)}`],
      dependencies: {
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance,
        readWalletStakedKeys: async () => null,
      },
    })

    expect(access).toEqual({
      allowed: true,
      reason: 'room_key',
      walletAddress: `0x${'bb'.repeat(20)}`,
    })
  })

  it('expands FriendKey checks across linked CSW and owner wallets', async () => {
    const membership = `0x${'aa'.repeat(20)}` as const
    const canonical = `0x${'bb'.repeat(20)}` as const
    const owner = `0x${'cc'.repeat(20)}` as const
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      canonicalSmartWalletAddress: canonical,
      activeOwnerWalletAddress: owner,
    })

    await expect(expandFriendKeyCheckWallets(membership)).resolves.toEqual([
      membership,
      canonical,
      owner,
    ])

    const held = await walletHoldsOrStakesRoomFriendKey({
      roomId: '1659',
      walletAddress: membership,
      dependencies: {
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async ({ wallet }) => (wallet === owner ? 1n : 0n),
        readWalletStakedKeys: async () => 0,
      },
    })
    expect(held).toBe(true)
  })
})
