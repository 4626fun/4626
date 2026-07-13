import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDbMock,
  getTelegramLinkByUserIdMock,
  readProfileWalletAuthorityMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  readProfileWalletAuthorityMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({ getDb: getDbMock }))
vi.mock('../messaging/telegramTrading.js', () => ({
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
}))
vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  readProfileWalletAuthority: readProfileWalletAuthorityMock,
}))

import { validateTelegramAlfaClubIssuer } from './telegramIssuerValidator.js'

const canonical = `0x${'ab'.repeat(20)}` as const

describe('validateTelegramAlfaClubIssuer', () => {
  const sql = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql })
    getTelegramLinkByUserIdMock.mockResolvedValue({
      profileId: 42,
      canonicalCswAddress: canonical,
      linkStatus: 'active',
      revokedAt: null,
    })
    readProfileWalletAuthorityMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: canonical,
      activeOwnerWalletAddress: `0x${'cd'.repeat(20)}`,
    })
    sql.mockResolvedValue({ rows: [{ '?column?': 1 }] })
  })

  it('allows an active linked profile with exact canonical CSW membership', async () => {
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toEqual({ profileId: 42, canonicalIssuer: canonical })
    expect(sql.mock.calls[0]?.slice(1)).toEqual(['1659', canonical])
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
    expect(sql).not.toHaveBeenCalled()
  })

  it('denies canonical drift, revoked links, and inactive room membership', async () => {
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

    sql.mockResolvedValueOnce({ rows: [] })
    await expect(validateTelegramAlfaClubIssuer({
      roomId: '1659',
      telegramUserId: '123',
    })).resolves.toBeNull()
  })
})
