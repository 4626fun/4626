import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_profile-complete.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipalMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  awardWaitlistPointsMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
  isAuthorizedWalletForProfileMock,
  isCswOwnerMock,
  verifyCswProvenanceMock,
} = vi.hoisted(() => ({
  readRequestPrincipalAddressMock: vi.fn(() => ''),
  resolveAuthorizedRequestPrincipalMock: vi.fn(async () => null),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  awardWaitlistPointsMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  isAuthorizedWalletForProfileMock: vi.fn(async () => false),
  isCswOwnerMock: vi.fn(async () => false),
  verifyCswProvenanceMock: vi.fn(async () => false),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body),
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  awardWaitlistPoints: awardWaitlistPointsMock,
  WAITLIST_POINTS: { qualifiedReferral: 25 },
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  isCswOwner: isCswOwnerMock,
  verifyCswProvenance: verifyCswProvenanceMock,
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles') && text.includes('where email')) {
        return { rows: [{ id: 1, csw_address: null, primary_smart_wallet: null, base_sub_account: null }] }
      }
      if (text.includes('update profiles') && text.includes('set profile_completed_at')) {
        return { rows: [{ id: 1, profile_completed_at: new Date().toISOString() }] }
      }
      if (text.includes('from referral_conversions')) return { rows: [] }
      return { rows: [] }
    }),
  }
}

function createDbHistoricalLinkedWallet() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('update profiles') && text.includes('where email')) {
        // Simulate no direct legacy-column wallet match.
        return { rows: [] }
      }
      if (text.includes('from profiles') && text.includes('where email')) {
        // Existing signup exists for this email.
        return { rows: [{ id: 1, csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5' }] }
      }
      if (text.includes('from profile_wallets')) {
        // Principal is only a historical linked wallet, not current authority.
        return { rows: [{ exists: 1 }] }
      }
      if (text.includes('update profiles') && text.includes('where id')) {
        return { rows: [{ id: 1, profile_completed_at: new Date().toISOString() }] }
      }
      if (text.includes('from referral_conversions')) return { rows: [] }
      return { rows: [] }
    }),
  }
}

describe('waitlist/profile-complete auth parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb())
    readRequestPrincipalAddressMock.mockReturnValue('')
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue(null)
    isAuthorizedWalletForProfileMock.mockResolvedValue(false)
    isCswOwnerMock.mockResolvedValue(false)
    verifyCswProvenanceMock.mockResolvedValue(false)
  })

  it('returns 401 when no session and no SIWA', async () => {
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })

  it('accepts session principal', async () => {
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue({
      profileId: 1,
      address: '0x00000000000000000000000000000000000000aa',
      source: 'session',
      authSource: 'session',
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: '0x00000000000000000000000000000000000000aa',
      signerRole: 'active_owner_wallet',
    } as any)
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('accepts SIWA principal when session is missing', async () => {
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000bb')
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue({
      profileId: 1,
      address: '0x00000000000000000000000000000000000000bb',
      source: 'siwa',
      authSource: 'siwa',
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: '0x00000000000000000000000000000000000000bb',
      signerRole: 'active_owner_wallet',
    } as any)
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('rejects principals that are only historical linked wallets', async () => {
    getDbMock.mockResolvedValue(createDbHistoricalLinkedWallet())
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toMatch(/not authorized/i)
  })
})
