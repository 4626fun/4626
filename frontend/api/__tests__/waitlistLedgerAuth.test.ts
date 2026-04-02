import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_ledger.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  ensureWaitlistSchemaMock,
  isAuthorizedWalletForProfileMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  readRequestPrincipalAddressMock: vi.fn(() => ''),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn(() => 'waitlist-ledger:test'),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  isAuthorizedWalletForProfileMock: vi.fn(async () => false),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/referrals.js', () => ({
  normalizeReferralCode: vi.fn((value: string) => String(value || '').trim().toLowerCase()),
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles p') && text.includes('canonical.address as canonical_wallet')) {
        return {
          rows: [
            {
              id: 7,
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
              id: 7,
              referral_code: 'C7',
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
      if (text.includes('from profiles') && text.includes('where referral_code')) {
        return {
          rows: [
            {
              id: 7,
              referral_code: 'C7',
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
        return { rows: [] }
      }
      if (text.includes('from points') && text.includes('as total') && text.includes('where signup_id')) {
        return { rows: [{ total: 120 }] }
      }
      if (text.includes('from points') && text.includes('order by created_at desc')) {
        return {
          rows: [
            {
              source: 'waitlist_signup',
              source_id: 'email:owner@example.com',
              amount: 100,
              created_at: '2026-03-03T00:00:00.000Z',
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

function createDbHistoricalLinkedWallet() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles p') && text.includes('canonical.address as canonical_wallet')) {
        return {
          rows: [
            {
              id: 7,
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
              id: 7,
              referral_code: 'C7',
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
      if (text.includes('from points') && text.includes('as total') && text.includes('where signup_id')) {
        return { rows: [{ total: 120 }] }
      }
      if (text.includes('from points') && text.includes('order by created_at desc')) {
        return {
          rows: [
            {
              source: 'waitlist_signup',
              source_id: 'email:owner@example.com',
              amount: 100,
              created_at: '2026-03-03T00:00:00.000Z',
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

describe('waitlist/ledger ownership hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb() as any)
    isAuthorizedWalletForProfileMock.mockResolvedValue(false)
  })

  it('returns null for unauthenticated email lookup', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    const req = createMockReq({
      method: 'GET',
      query: { email: 'owner@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })

  it('returns null for unauthenticated referral lookup', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    const req = createMockReq({
      method: 'GET',
      query: { ref: 'C7' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })

  it('returns ledger data for authorized owner', async () => {
    isAuthorizedWalletForProfileMock.mockResolvedValueOnce(true)
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000aa')
    const req = createMockReq({
      method: 'GET',
      query: { email: 'owner@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.signupId).toBe(7)
    expect(res.body?.data?.totalPoints).toBe(120)
    expect(Array.isArray(res.body?.data?.entries)).toBe(true)
  })

  it('returns null when caller is only a historical linked wallet', async () => {
    getDbMock.mockResolvedValue(createDbHistoricalLinkedWallet() as any)
    isAuthorizedWalletForProfileMock.mockResolvedValueOnce(false)
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000bb')
    const req = createMockReq({
      method: 'GET',
      query: { email: 'owner@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toBeNull()
  })
})
