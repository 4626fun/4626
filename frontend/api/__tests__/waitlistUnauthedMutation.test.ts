import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
  getDbMock,
  getDbInitErrorMock,
  ensureWaitlistSchemaMock,
  ensureWaitlistPointsSchemaMock,
  awardWaitlistPointsMock,
} = vi.hoisted(() => ({
  readRequestPrincipalAddressMock: vi.fn(() => ''),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getDbMock: vi.fn(),
  getDbInitErrorMock: vi.fn<() => string | null>(() => null),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  ensureWaitlistPointsSchemaMock: vi.fn(async () => {}),
  awardWaitlistPointsMock: vi.fn(async () => {}),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  RATE_LIMITS: { waitlistSignup: { windowMs: 60_000, maxRequests: 5 } },
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: vi.fn(() => 'waitlist:test'),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  isDbConfigured: vi.fn(() => true),
  getDbInitError: getDbInitErrorMock,
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { signup: 100, linkCsw: 50, referralSignup: 200 },
  ensureWaitlistPointsSchema: ensureWaitlistPointsSchemaMock,
  awardWaitlistPoints: awardWaitlistPointsMock,
}))

vi.mock('../../server/_lib/referrals.js', () => ({
  normalizeReferralCode: vi.fn((value: string) => String(value || '').trim().toLowerCase()),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'vitest'),
  hashForAttribution: vi.fn((value: string) => `h:${value}`),
}))

vi.mock('../../server/_lib/basenameResolver.js', () => ({
  resolveBasenameHandle: vi.fn(async () => null),
}))

vi.mock('../../server/_lib/waitlistPreprovision.js', () => ({
  preprovisionWaitlistUser: vi.fn(async () => null),
}))

vi.mock('../../server/_lib/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(() => null),
}))

import handler from '../_handlers/_waitlist.ts'

describe('waitlist unauthenticated mutation hardening', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    getDbInitErrorMock.mockReturnValue(null)
    restoreEnv = applyEnv({
      PRIVY_APP_ID: undefined,
      PRIVY_APP_SECRET: undefined,
      PRIVY_WAITLIST_PREGENERATE: 'false',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('does not persist non-wallet metadata when request is unauthenticated', async () => {
    const capturedInserts: any[][] = []
    const referralUpdateValues: any[][] = []
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('insert into profiles')) {
          capturedInserts.push(values)
          return { rows: [{ id: 42, created: false, email: 'victim@example.com', referral_code: null }] }
        }
        if (text.includes('set referral_code =') && text.includes('where id =')) {
          referralUpdateValues.push(values)
          return { rows: [{ referral_code: String(values[0] ?? '') }] }
        }
        return { rows: [] }
      }),
    } as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'victim@example.com',
        claimReferralCode: 'mycustomcode',
        solanaWallet: '11111111111111111111111111111111',
        contactPreference: 'email',
        intent: { persona: 'user', hasCreatorCoin: true },
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    const insertValues = capturedInserts[0]
    expect(insertValues).toBeDefined()

    // Values order in INSERT is stable in handler:
    // [ ..., base_sub_account, persona, has_creator_coin, contact_preference, verifications, ... ]
    expect(insertValues?.[2]).toBeNull()
    expect(insertValues?.[9]).toBeNull()
    expect(insertValues?.[10]).toBeNull()
    expect(insertValues?.[11]).toBeNull()
    expect(insertValues?.[12]).toBeNull()
    expect(referralUpdateValues[0]?.[0]).toBe('C16')
    expect(res.body?.data?.referralCode).toBe('C16')
  })

  it('does not leak raw database init errors when waitlist storage is unavailable', async () => {
    getDbMock.mockResolvedValue(null)
    getDbInitErrorMock.mockReturnValue('password authentication failed for user "postgres" at db.internal')

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'victim@example.com',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(500)
    const error = String(res.body?.error ?? '')
    expect(error).toContain('temporarily unavailable')
    expect(error).not.toContain('password authentication failed')
    expect(error).not.toContain('db.internal')
  })
})
