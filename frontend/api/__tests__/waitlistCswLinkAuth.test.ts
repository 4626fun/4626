import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_csw-link.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  awardWaitlistPointsMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readRequestPrincipalAddressMock,
  isAuthorizedWalletForProfileMock,
  verifyCswProvenanceMock,
  isCswOwnerMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  awardWaitlistPointsMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  isAuthorizedWalletForProfileMock: vi.fn(async () => false),
  verifyCswProvenanceMock: vi.fn(async () => true),
  isCswOwnerMock: vi.fn(async () => true),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  awardWaitlistPoints: awardWaitlistPointsMock,
  WAITLIST_POINTS: { linkCsw: 25, referralCswLink: 10 },
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  RATE_LIMITS: { cswLink: { windowMs: 60_000, maxRequests: 10 } },
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  verifyCswProvenance: verifyCswProvenanceMock,
  isCswOwner: isCswOwnerMock,
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles') && text.includes('where email =')) {
        return { rows: [{ id: 1, primary_wallet: '0xold', embedded_wallet: null, csw_address: null }] }
      }
      if (text.includes('where lower(csw_address) =')) return { rows: [] }
      if (text.includes('update profiles') && text.includes('set csw_address')) return { rows: [] }
      if (text.includes('select referred_by_signup_id')) return { rows: [] }
      return { rows: [] }
    }),
  }
}

describe('waitlist/csw-link auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb())
    isAuthorizedWalletForProfileMock.mockResolvedValue(false)
    verifyCswProvenanceMock.mockResolvedValue(true)
    isCswOwnerMock.mockResolvedValue(true)
  })

  it('rejects principals that only match stale legacy wallet columns', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'user@example.com',
        cswAddress: '0x00000000000000000000000000000000000000cc',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(isAuthorizedWalletForProfileMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      profileId: 1,
      address: '0x00000000000000000000000000000000000000aa',
    })
    expect(res.statusCode).toBe(403)
    expect(isCswOwnerMock).not.toHaveBeenCalled()
  })

  it('links a CSW for a strictly authorized profile owner', async () => {
    isAuthorizedWalletForProfileMock.mockResolvedValue(true)

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'user@example.com',
        cswAddress: '0x00000000000000000000000000000000000000cc',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(verifyCswProvenanceMock).toHaveBeenCalledWith('0x00000000000000000000000000000000000000cc')
    expect(isCswOwnerMock).toHaveBeenCalledWith(
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000cc',
    )
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })
})
