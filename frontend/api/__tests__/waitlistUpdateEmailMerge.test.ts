import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_update-email.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
  isAuthorizedWalletForProfileMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  readRequestPrincipalAddressMock: vi.fn(() => '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  isAuthorizedWalletForProfileMock: vi.fn(async (_params?: any) => true),
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

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  RATE_LIMITS: { updateEmail: { windowMs: 60_000, maxRequests: 5 } },
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

type DbOptions = {
  ownTargetEmail: boolean
}

function createDb(options: DbOptions) {
  const currentEmail = '0xb05cf0+1ktesbv@noemail.4626.fun'
  const newEmail = 'akitav2@proton.me'

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      // Ownership check helper query.
      if (text.includes('from profiles p') && text.includes('where p.email =')) {
        const email = String(values[0] ?? '').toLowerCase()
        if (email === currentEmail) return { rows: [{ id: 267, email: currentEmail }] }
        if (email === newEmail) return { rows: [{ id: 1, email: newEmail }] }
        return { rows: [] }
      }

      // Primary update attempt fails when new email already exists.
      if (text.includes('update profiles') && text.includes('set email =') && text.includes('not exists (select 1 from profiles')) {
        return { rows: [] }
      }

      // Conflict check sees the destination email already exists.
      if (text.includes('select id from profiles where email =')) {
        return { rows: [{ id: 1 }] }
      }

      // Unique-value read for merge path.
      if (text.includes('select src.privy_user_id as source_privy_user_id')) {
        return {
          rows: [
            {
              source_privy_user_id: null,
              source_referral_code: null,
              source_referral_claimed_at: null,
              target_privy_user_id: 'did:privy:test',
              target_referral_code: null,
            },
          ],
        }
      }

      // Delete source profile during merge.
      if (text.includes('delete from profiles where id =') && text.includes('returning id')) {
        return { rows: [{ id: 267 }] }
      }

      return { rows: [] }
    }),
  }
}

describe('waitlist/update-email merge-on-conflict', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb({ ownTargetEmail: true }))
    isAuthorizedWalletForProfileMock.mockImplementation(async ({ profileId }: { profileId: number }) => profileId === 267 || profileId === 1)
  })

  it('merges synthetic profile into existing owned profile when target email is already taken', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        currentEmail: '0xb05cf0+1ktesbv@noemail.4626.fun',
        newEmail: 'akitav2@proton.me',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.email).toBe('akitav2@proton.me')

    const db = await getDbMock.mock.results[0]?.value
    const sqlCalls = db.sql.mock.calls.map((c: unknown[]) => String((c[0] as TemplateStringsArray).join(' ')).toLowerCase())
    expect(sqlCalls.some((q: string) => q.includes('delete from profiles where id =') && q.includes('returning id'))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('insert into profile_wallets'))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('update points src') && q.includes('set signup_id ='))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('update referral_conversions') && q.includes('set referrer_signup_id ='))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('set invitee_signup_id ='))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('update profiles') && q.includes('set referred_by_signup_id ='))).toBe(true)
  })

  it('returns 409 when target email exists but is not owned by caller', async () => {
    getDbMock.mockResolvedValueOnce(createDb({ ownTargetEmail: false }))
    isAuthorizedWalletForProfileMock.mockImplementation(async ({ profileId }: { profileId: number }) => profileId === 267)

    const req = createMockReq({
      method: 'POST',
      body: {
        currentEmail: '0xb05cf0+1ktesbv@noemail.4626.fun',
        newEmail: 'akitav2@proton.me',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Email already in use')
  })
})

