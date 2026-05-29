import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_referrer.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, checkRateLimitMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000, remaining: 60 })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '../../@4626/server-core',
  )
  return {
    ...actual,
    handleOptions: vi.fn(() => false),
    setCors: vi.fn(),
    setNoStore: vi.fn(),
    getDb: getDbMock,
    checkRateLimit: checkRateLimitMock,
    getClientIp: vi.fn(() => '127.0.0.1'),
    rateLimitKey: vi.fn((scope: string, ip: string) => `${scope}:${ip}`),
  }
})

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

describe('waitlist/referrer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000, remaining: 60 })
  })

  function buildDbMock(options: {
    profile?: { id: number; primary_wallet?: string | null; embedded_wallet?: string | null } | null
    pointsTotal?: number
    rank?: number | null
  } = {}) {
    const { profile = null, pointsTotal = 0, rank = null } = options
    return {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles where referral_code')) {
          return { rows: profile ? [profile] : [] }
        }
        if (text.includes('as total from points where signup_id')) {
          return { rows: [{ total: pointsTotal }] }
        }
        if (text.includes('select rank from ranked where signup_id')) {
          return { rows: rank !== null ? [{ rank }] : [] }
        }
        return { rows: [] }
      }),
    }
  }

  it('rejects non-GET methods', async () => {
    const req = createMockReq({ method: 'POST', query: { code: 'ABC' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects an invalid / empty code with 400', async () => {
    const req = createMockReq({ method: 'GET', query: { code: '!!!' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 429 when rate-limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 30_000, remaining: 0 })
    const req = createMockReq({ method: 'GET', query: { code: 'AKITA' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
  })

  it('returns data:null (200) for a code that matches no profile — does not leak existence via status', async () => {
    getDbMock.mockResolvedValue(buildDbMock({ profile: null }) as any)
    const req = createMockReq({ method: 'GET', query: { code: 'NOBODYHASTHIS' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })

  it('returns a shortened-wallet display for a matched profile', async () => {
    getDbMock.mockResolvedValue(
      buildDbMock({
        profile: { id: 42, primary_wallet: '0x00000000000000000000000000000000000000aa', embedded_wallet: null },
        pointsTotal: 150,
        rank: 7,
      }) as any,
    )
    const req = createMockReq({ method: 'GET', query: { code: 'AKITA' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    const data = res.body?.data
    expect(data).toBeTruthy()
    // Display must be the short-wallet form — never expose email / full address.
    expect(data.display.startsWith('0x0000')).toBe(true)
    expect(data.display.includes('…')).toBe(true)
    expect(data.pointsTotal).toBe(150)
    expect(data.rank).toBe(7)
    // Explicitly ensure no PII fields bleed through.
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['display', 'pointsTotal', 'rank']))
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('primaryWallet')
    expect(data).not.toHaveProperty('wallet')
  })

  it('falls back to user#<id> when wallet is missing', async () => {
    getDbMock.mockResolvedValue(
      buildDbMock({
        profile: { id: 99, primary_wallet: null, embedded_wallet: null },
        pointsTotal: 12,
        rank: null,
      }) as any,
    )
    const req = createMockReq({ method: 'GET', query: { code: 'ABCDEF' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.display).toBe('user#99')
    expect(res.body?.data?.rank).toBeNull()
  })

  it('normalizes lowercase + non-alphanumeric input before lookup', async () => {
    const dbMock = buildDbMock({
      profile: { id: 1, primary_wallet: '0x00000000000000000000000000000000000000ab', embedded_wallet: null },
      pointsTotal: 5,
      rank: 1,
    })
    getDbMock.mockResolvedValue(dbMock as any)
    const req = createMockReq({ method: 'GET', query: { code: ' akita!-123 ' } })
    const res = createMockRes()
    await handler(req, res)
    // Normalized code should be "AKITA123".
    const sqlCalls = (dbMock.sql as any).mock.calls as Array<[TemplateStringsArray, ...unknown[]]>
    const lookupCall = sqlCalls.find(([strings]) =>
      strings
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .includes('from profiles where referral_code'),
    )
    expect(lookupCall).toBeTruthy()
    const lookupArgs = lookupCall?.slice(1) ?? []
    expect(lookupArgs[0]).toBe('AKITA123')
  })
})
