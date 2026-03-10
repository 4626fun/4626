import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_preprovision.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  isDbConfiguredMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipalMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn(() => 'waitlist-preprovision:test'),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  resolveAuthorizedRequestPrincipalMock: vi.fn(async (): Promise<any> => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  isCswOwner: vi.fn(async () => false),
}))

vi.mock('../../server/_lib/waitlistPreprovision.js', () => ({
  preprovisionWaitlistUser: vi.fn(async () => null),
}))

describe('waitlist/preprovision rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 15_000,
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Too many requests')
    expect(String(res.getHeader('Retry-After') ?? '')).not.toBe('')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('uses the authorized profile mapping instead of raw legacy wallet-column matching', async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 15_000,
    })
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000bb')
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue({
      source: 'session',
      authSource: 'session',
      address: '0x00000000000000000000000000000000000000bb',
      profileId: 7,
      canonicalSmartWalletAddress: '0x00000000000000000000000000000000000000cc',
      activeOwnerWalletAddress: '0x00000000000000000000000000000000000000bb',
      signerRole: 'active_owner_wallet',
    })
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('where lower(primary_wallet)')) {
          return { rows: [] }
        }
        if (text.includes('where csw_address is not null')) {
          return {
            rows: [
              {
                id: 7,
                primary_wallet: '0x00000000000000000000000000000000000000aa',
                embedded_wallet: null,
                csw_address: '0x00000000000000000000000000000000000000cc',
                primary_smart_wallet: '0x00000000000000000000000000000000000000cc',
                base_sub_account: '0x00000000000000000000000000000000000000cc',
                preprovisioned_at: null,
              },
            ],
          }
        }
        if (text.includes('where id =')) {
          return {
            rows: [
              {
                id: 7,
                primary_wallet: '0x00000000000000000000000000000000000000aa',
                embedded_wallet: null,
                csw_address: '0x00000000000000000000000000000000000000cc',
                primary_smart_wallet: '0x00000000000000000000000000000000000000cc',
                base_sub_account: '0x00000000000000000000000000000000000000cc',
                preprovisioned_at: null,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.signupId).toBe(7)
  })
})
