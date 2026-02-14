import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_profile-complete.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readSessionFromRequestMock,
  readSiwaAgentFromRequestMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  ensureWaitlistPointsSchemaMock,
  awardWaitlistPointsMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
} = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  ensureWaitlistPointsSchemaMock: vi.fn(async () => {}),
  awardWaitlistPointsMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body),
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  ensureWaitlistPointsSchema: ensureWaitlistPointsSchemaMock,
  awardWaitlistPoints: awardWaitlistPointsMock,
  WAITLIST_POINTS: { qualifiedReferral: 25 },
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  isCswOwner: vi.fn(async () => false),
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('update profiles') && text.includes('set profile_completed_at')) {
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
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)
  })

  it('returns 401 when no session and no SIWA', async () => {
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })

  it('accepts session principal', async () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0x00000000000000000000000000000000000000aa' } as any)
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('accepts SIWA principal when session is missing', async () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue({
      address: '0x00000000000000000000000000000000000000bb',
      agentId: 42,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      chainId: 8453,
    } as any)
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })
})
