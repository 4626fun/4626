import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_refresh.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  resolveAndPersistZoraSignalsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  resolveAndPersistZoraSignalsMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  resolveAndPersistZoraSignals: resolveAndPersistZoraSignalsMock,
}))

describe('POST /api/zora/refresh fallback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
  })

  it('falls back to persisted signals when forced refresh is rate-limited', async () => {
    const rateLimitedError = Object.assign(new Error('zora_refresh_rate_limited:595'), {
      code: 'ZORA_REFRESH_RATE_LIMITED',
      retryAfterSec: 595,
    })

    resolveAndPersistZoraSignalsMock
      .mockRejectedValueOnce(rateLimitedError)
      .mockResolvedValueOnce({
        zoraLinked: true,
        canonicalCswAddress: '0x1111111111111111111111111111111111111111',
        creatorCoin: {
          address: '0x2222222222222222222222222222222222222222',
          name: 'Creator Coin',
          symbol: 'COIN',
        },
        zoraHandle: 'akita',
        lastResolvedAt: '2026-04-12T00:00:00.000Z',
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
    expect(res.body?.data?.zoraHandle).toBe('akita')
    expect(res.getHeader('x-zora-refresh-limited')).toBe('1')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(resolveAndPersistZoraSignalsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ forceRefresh: true, refreshWindowMs: 600000 }),
    )
    expect(resolveAndPersistZoraSignalsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ forceRefresh: false }),
    )
  })

  it('returns 429 when forced refresh is rate-limited and fallback cannot be read', async () => {
    const rateLimitedError = Object.assign(new Error('zora_refresh_rate_limited:300'), {
      code: 'ZORA_REFRESH_RATE_LIMITED',
      retryAfterSec: 300,
    })

    resolveAndPersistZoraSignalsMock
      .mockRejectedValueOnce(rateLimitedError)
      .mockRejectedValueOnce(new Error('fallback failed'))

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Refresh is rate-limited')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})

