import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDbMock,
  getTelegramLinkByUserIdMock,
  readProfileWalletAuthorityMock,
  resolveRoomFriendKeyAccessMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  readProfileWalletAuthorityMock: vi.fn(),
  resolveRoomFriendKeyAccessMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({ getDb: getDbMock }))
vi.mock('../messaging/telegramTrading.js', () => ({
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
}))
vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  readProfileWalletAuthority: readProfileWalletAuthorityMock,
}))
vi.mock('./roomFriendKeyAccess.js', () => ({
  resolveRoomFriendKeyAccess: resolveRoomFriendKeyAccessMock,
}))

import { validateTelegramAlfaClubIssuer } from './telegramIssuerValidator.js'

const canonical = `0x${'ab'.repeat(20)}` as const
const owner = `0x${'cd'.repeat(20)}` as const

describe('validateTelegramAlfaClubIssuer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    getTelegramLinkByUserIdMock.mockResolvedValue({
      profileId: 42,
      canonicalCswAddress: canonical,
      linkStatus: 'active',
      revokedAt: null,
    })
    readProfileWalletAuthorityMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: canonical,
      activeOwnerWalletAddress: owner,
    })
    resolveRoomFriendKeyAccessMock.mockResolvedValue({
      allowed: true,
      reason: 'room_key',
      walletAddress: owner,
    })
  })

  it('allows an active linked profile with FriendKey write access', async () => {
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toEqual({ profileId: 42, canonicalIssuer: canonical })
    expect(resolveRoomFriendKeyAccessMock).toHaveBeenCalledWith({
      roomId: '1659',
      wallets: [canonical, owner],
      tokenIdHint: '1659',
    })
  })

  it('denies unlinked and inactive Telegram users', async () => {
    getTelegramLinkByUserIdMock.mockResolvedValueOnce(null)
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()

    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      profileId: 42,
      canonicalCswAddress: canonical,
      linkStatus: 'pending_wallet_setup',
      revokedAt: null,
    })
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()
    expect(resolveRoomFriendKeyAccessMock).not.toHaveBeenCalled()
  })

  it('denies canonical drift, revoked links, and missing FriendKey', async () => {
    readProfileWalletAuthorityMock.mockResolvedValueOnce({
      profileId: 42,
      canonicalSmartWalletAddress: `0x${'ef'.repeat(20)}`,
      activeOwnerWalletAddress: null,
    })
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()

    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      profileId: 42,
      canonicalCswAddress: canonical,
      linkStatus: 'active',
      revokedAt: '2026-07-12T00:00:00.000Z',
    })
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()

    resolveRoomFriendKeyAccessMock.mockResolvedValueOnce({
      allowed: false,
      reason: 'insufficient',
      walletAddress: canonical,
    })
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()
  })
})
