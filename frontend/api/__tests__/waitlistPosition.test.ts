import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_position.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

function createPositionDb(params: { id: string | number; email: string }) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('from profiles') && text.includes('where email')) {
        return {
          rows: [
            {
              id: params.id,
              email: params.email,
              referral_code: 'AKITA',
              profile_completed_at: '2026-02-25T00:00:00.000Z',
              border_tier: 1,
            },
          ],
        }
      }

      if (text.includes('from profiles') && text.includes('where lower(primary_wallet)')) {
        return {
          rows: [
            {
              id: params.id,
              email: params.email,
              referral_code: 'AKITA',
              profile_completed_at: '2026-02-25T00:00:00.000Z',
              border_tier: 1,
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

describe('waitlist/position', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data when profile id is a numeric string', async () => {
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

  it('returns resolved profile email for wallet lookup', async () => {
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
    expect(res.body?.data?.email).toBe('wallet-owner@proton.me')
  })
})
