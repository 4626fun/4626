import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveRoomChatViewAccess, resolveRoomChatWriteAccess } from './roomChatViewAccess.js'

const WALLET = '0x1111111111111111111111111111111111111111' as const
const CSW = '0x2222222222222222222222222222222222222222' as const

describe('resolveRoomChatViewAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('denies anonymous callers', async () => {
    await expect(
      resolveRoomChatViewAccess({ roomId: '1659', sessionAddress: null }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'anonymous',
      walletAddress: null,
      canWrite: false,
    })
  })

  it('allows active membership without requiring FriendKey write', async () => {
    const readMembership = vi.fn(async () => ({
      roomId: '1659',
      walletAddress: WALLET,
      status: 'active' as const,
      creatorCoinBalanceRaw: '1',
      quoteThresholdRaw: '1',
      lastCheckedAt: null,
      lastEligibleAt: null,
      graceStartedAt: null,
      failureReason: null,
    }))

    await expect(
      resolveRoomChatViewAccess({
        roomId: '1659',
        sessionAddress: WALLET,
        dependencies: {
          resolveWallets: async () => [WALLET],
          readMembership,
          readPolicy: async () => null,
          getPublicClient: async () => ({}) as never,
          readWalletKeyBalance: async () => 0n,
          readWalletStakedKeys: async () => 0,
        },
      }),
    ).resolves.toEqual({
      allowed: true,
      reason: 'membership',
      walletAddress: WALLET,
      canWrite: false,
    })
  })

  it('allows wallet-held FriendKeys with write', async () => {
    const access = await resolveRoomChatViewAccess({
      roomId: '1659',
      sessionAddress: WALLET,
      dependencies: {
        resolveWallets: async () => [WALLET, CSW],
        readMembership: async () => null,
        readPolicy: async () => null,
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async ({ wallet }) => (wallet === CSW ? 2n : 0n),
        readWalletStakedKeys: async () => 0,
      },
    })
    expect(access).toEqual({
      allowed: true,
      reason: 'room_key',
      walletAddress: CSW,
      canWrite: true,
    })
  })

  it('allows staked-only FriendKeys with write', async () => {
    const access = await resolveRoomChatViewAccess({
      roomId: '1659',
      sessionAddress: WALLET,
      dependencies: {
        resolveWallets: async () => [WALLET],
        readMembership: async () => null,
        readPolicy: async () => null,
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => 0n,
        readWalletStakedKeys: async () => 1,
      },
    })
    expect(access).toEqual({
      allowed: true,
      reason: 'staked_key',
      walletAddress: WALLET,
      canWrite: true,
    })
  })

  it('allows creator-coin equivalent as read-only', async () => {
    const access = await resolveRoomChatViewAccess({
      roomId: '1659',
      sessionAddress: WALLET,
      dependencies: {
        resolveWallets: async () => [WALLET],
        readMembership: async () => null,
        readPolicy: async () => ({
          roomId: '1659',
          tokenId: '1659',
          creatorCoinAddress: '0x3333333333333333333333333333333333333333',
          poolAddress: '0x4444444444444444444444444444444444444444',
          keyAmountRaw: '1',
          enterThresholdBps: 10_000,
          exitThresholdBps: 9_000,
          graceHours: 24,
          enabled: true,
        }),
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => 0n,
        readWalletStakedKeys: async () => 0,
        evaluateCoinEligibility: async () => ({
          canEnter: true,
          canStayActive: true,
          reason: 'balance>=enter_threshold',
          evidence: {
            creatorCoinBalanceRaw: '1000',
            quoteThresholdRaw: '1000',
            enterThresholdRaw: '1000',
            exitThresholdRaw: '900',
            blockNumber: 1,
            rpcUrl: null,
          },
        }),
      },
    })
    expect(access).toEqual({
      allowed: true,
      reason: 'coin_equivalent',
      walletAddress: WALLET,
      canWrite: false,
    })
  })

  it('denies when signed in without key or equivalent', async () => {
    const access = await resolveRoomChatViewAccess({
      roomId: '1659',
      sessionAddress: WALLET,
      dependencies: {
        resolveWallets: async () => [WALLET],
        readMembership: async () => null,
        readPolicy: async () => ({
          roomId: '1659',
          tokenId: '1659',
          creatorCoinAddress: '0x3333333333333333333333333333333333333333',
          poolAddress: '0x4444444444444444444444444444444444444444',
          keyAmountRaw: '1',
          enterThresholdBps: 10_000,
          exitThresholdBps: 9_000,
          graceHours: 24,
          enabled: true,
        }),
        getPublicClient: async () => ({}) as never,
        readWalletKeyBalance: async () => 0n,
        readWalletStakedKeys: async () => 0,
        evaluateCoinEligibility: async () => ({
          canEnter: false,
          canStayActive: false,
          reason: 'balance<enter_threshold',
          evidence: {
            creatorCoinBalanceRaw: '0',
            quoteThresholdRaw: '1000',
            enterThresholdRaw: '1000',
            exitThresholdRaw: '900',
            blockNumber: 1,
            rpcUrl: null,
          },
        }),
      },
    })
    expect(access).toEqual({
      allowed: false,
      reason: 'insufficient',
      walletAddress: WALLET,
      canWrite: false,
    })
  })
})

describe('resolveRoomChatWriteAccess', () => {
  it('allows FriendKey holders', async () => {
    await expect(
      resolveRoomChatWriteAccess({
        roomId: '1659',
        sessionAddress: WALLET,
        dependencies: {
          resolveWallets: async () => [WALLET],
          readPolicy: async () => null,
          getPublicClient: async () => ({}) as never,
          readWalletKeyBalance: async () => 1n,
          readWalletStakedKeys: async () => 0,
        },
      }),
    ).resolves.toEqual({
      allowed: true,
      reason: 'room_key',
      walletAddress: WALLET,
    })
  })

  it('rejects coin-only wallets without FriendKey', async () => {
    await expect(
      resolveRoomChatWriteAccess({
        roomId: '1659',
        sessionAddress: WALLET,
        dependencies: {
          resolveWallets: async () => [WALLET],
          readPolicy: async () => ({
            roomId: '1659',
            tokenId: '1659',
            creatorCoinAddress: '0x3333333333333333333333333333333333333333',
            poolAddress: '0x4444444444444444444444444444444444444444',
            keyAmountRaw: '1',
            enterThresholdBps: 10_000,
            exitThresholdBps: 9_000,
            graceHours: 24,
            enabled: true,
          }),
          getPublicClient: async () => ({}) as never,
          readWalletKeyBalance: async () => 0n,
          readWalletStakedKeys: async () => 0,
        },
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'friendkey_required',
      walletAddress: WALLET,
    })
  })
})
