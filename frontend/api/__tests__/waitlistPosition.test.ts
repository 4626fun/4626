import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_position.ts'
import { canonicalWalletSchemaReadyResult, createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
}))
const { readRequestPrincipalAddressMock, checkRateLimitMock, rateLimitKeyMock, getClientIpMock } = vi.hoisted(() => ({
  readRequestPrincipalAddressMock: vi.fn(() => ''),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'waitlist-position:test'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/wallet/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

function createPositionDb(params: { id: string | number; email: string }) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      const schemaReady = canonicalWalletSchemaReadyResult(text)
      if (schemaReady) return schemaReady

      if (text.includes('from profiles p') && text.includes('canonical.address as canonical_wallet')) {
        return {
          rows: [
            {
              id: params.id,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              primary_embedded_eoa: null,
              primary_smart_wallet: null,
              csw_address: null,
              base_sub_account: null,
              canonical_wallet: null,
            },
          ],
        }
      }

      if (text.includes('from profiles') && text.includes('where email')) {
        return {
          rows: [
            {
              id: params.id,
              email: params.email,
              referral_code: 'AKITA',
              profile_completed_at: '2026-02-25T00:00:00.000Z',
              border_tier: 1,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              embedded_wallet: null,
              primary_embedded_eoa: null,
              csw_address: null,
              primary_smart_wallet: null,
              base_sub_account: null,
            },
          ],
        }
      }

      if (
        text.includes('from profiles') &&
        (text.includes('where lower(primary_wallet)') || text.includes('where lower(p.primary_wallet)'))
      ) {
        return {
          rows: [
            {
              id: params.id,
              email: params.email,
              referral_code: 'AKITA',
              profile_completed_at: '2026-02-25T00:00:00.000Z',
              border_tier: 1,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              embedded_wallet: null,
              primary_embedded_eoa: null,
              csw_address: null,
              primary_smart_wallet: null,
              base_sub_account: null,
            },
          ],
        }
      }

      if (text.includes('from points')) {
        return {
          rows: [{ total: 150, invite: 50, signup: 100, tasks: 0, csw: 0, social: 0, bonus: 0 }],
        }
      }

      if (text.includes('from referral_conversions') && text.includes('qualified_at is not null')) {
        return { rows: [{ c: 2 }] }
      }

      if (text.includes('from referral_conversions') && text.includes('not (status = \'csw_linked\'')) {
        return { rows: [{ c: 1 }] }
      }

      if (text.includes('count(*)::int as c') && text.includes('from profiles')) {
        return { rows: [{ c: 8 }] }
      }

      if (text.includes('rank_invite')) {
        return { rows: [{ rank_invite: 3 }] }
      }

      if (text.includes('rank_total')) {
        return { rows: [{ rank_total: 4 }] }
      }

      return { rows: [] }
    }),
  }
}

function createPositionDbHistoricalLinkedWallet(params: { id: string | number; email: string }) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      const schemaReady = canonicalWalletSchemaReadyResult(text)
      if (schemaReady) return schemaReady

      if (text.includes('from profiles p') && text.includes('canonical.address as canonical_wallet')) {
        return {
          rows: [
            {
              id: params.id,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              primary_embedded_eoa: null,
              primary_smart_wallet: null,
              csw_address: null,
              base_sub_account: null,
              canonical_wallet: null,
            },
          ],
        }
      }

      if (text.includes('from profiles') && text.includes('where email')) {
        return {
          rows: [
            {
              id: params.id,
              email: params.email,
              referral_code: 'AKITA',
              profile_completed_at: '2026-02-25T00:00:00.000Z',
              border_tier: 1,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              embedded_wallet: null,
              primary_embedded_eoa: null,
              csw_address: null,
              primary_smart_wallet: null,
              base_sub_account: null,
            },
          ],
        }
      }

      if (text.includes('from profile_wallets')) {
        return { rows: [{ exists: 1 }] }
      }

      if (text.includes('from points')) {
        return {
          rows: [{ total: 150, invite: 50, signup: 100, tasks: 0, csw: 0, social: 0, bonus: 0 }],
        }
      }

      if (text.includes('from referral_conversions') && text.includes('qualified_at is not null')) {
        return { rows: [{ c: 2 }] }
      }

      if (text.includes('from referral_conversions') && text.includes('not (status = \'csw_linked\'')) {
        return { rows: [{ c: 1 }] }
      }

      if (text.includes('count(*)::int as c') && text.includes('from profiles')) {
        return { rows: [{ c: 8 }] }
      }

      if (text.includes('rank_invite')) {
        return { rows: [{ rank_invite: 3 }] }
      }

      if (text.includes('rank_total')) {
        return { rows: [{ rank_total: 4 }] }
      }

      return { rows: [] }
    }),
  }
}

describe('waitlist/position', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data when profile id is a numeric string', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000aa')
    getDbMock.mockResolvedValue(createPositionDb({ id: '42', email: 'akitav2@proton.me' }) as any)

    const req = createMockReq({
      method: 'GET',
      query: { email: 'akitav2@proton.me' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).not.toBeNull()
    expect(res.body?.data?.signupId).toBe(42)
    expect(res.body?.data?.email).toBe('akitav2@proton.me')
    expect(res.body?.data?.borderTier).toBe(1)
    expect(res.body?.data?.points?.total).toBe(150)
  })

  it('redacts email for wallet-address lookup and checks extended wallet fields', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000aa')
    getDbMock.mockResolvedValue(createPositionDb({ id: '7', email: 'wallet-owner@proton.me' }) as any)

    const req = createMockReq({
      method: 'GET',
      query: { wallet: '0x00000000000000000000000000000000000000aa' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).not.toBeNull()
    expect(res.body?.data?.signupId).toBe(7)
    expect(res.body?.data?.email).toBeNull()

    const db = await getDbMock.mock.results[0]?.value
    const sqlCalls = db.sql.mock.calls.map((c: unknown[]) => String((c[0] as TemplateStringsArray).join(' ')).toLowerCase())
    expect(sqlCalls.some((q: string) => q.includes('from profile_wallets pw'))).toBe(true)
    expect(sqlCalls.some((q: string) => q.includes('lower(p.csw_address)'))).toBe(true)
  })

  it('returns null for wallet-address lookup when caller is not authorized', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    getDbMock.mockResolvedValue(createPositionDb({ id: '7', email: 'wallet-owner@proton.me' }) as any)

    const req = createMockReq({
      method: 'GET',
      query: { wallet: '0x00000000000000000000000000000000000000aa' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })

  it('returns null for email lookup when caller is not authorized', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    getDbMock.mockResolvedValue(createPositionDb({ id: '7', email: 'wallet-owner@proton.me' }) as any)

    const req = createMockReq({
      method: 'GET',
      query: { email: 'wallet-owner@proton.me' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })

  it('returns null when caller is only a historical linked wallet', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000bb')
    getDbMock.mockResolvedValue(createPositionDbHistoricalLinkedWallet({ id: '7', email: 'wallet-owner@proton.me' }) as any)

    const req = createMockReq({
      method: 'GET',
      query: { email: 'wallet-owner@proton.me' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })
})
