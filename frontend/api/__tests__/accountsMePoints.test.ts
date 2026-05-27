import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/accounts/_mePoints.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, verifyPrivyForAccountsMock, buildAccountTrayPointsForPrivyUserMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(async () => ({
    privyUserId: 'did:privy:test',
    privyUser: { id: 'did:privy:test' },
  })),
  buildAccountTrayPointsForPrivyUserMock: vi.fn(),
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
  ensureWaitlistSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/identity/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
}))

vi.mock('../../server/_lib/onboarding/accountTrayPoints.js', () => ({
  buildAccountTrayPointsForPrivyUser: buildAccountTrayPointsForPrivyUserMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn(() => 'accounts-me-points:test'),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

const samplePayload = {
  signupId: 42,
  tier: 2,
  leaderboardEligible: true,
  points: { total: 150, invite: 50, signup: 100, tasks: 0, csw: 0, social: 0, bonus: 0 },
  rank: { invite: 3, total: 4 },
  totalCount: 8,
  activity: [
    {
      id: 'pt-1',
      source: 'waitlist_signup',
      label: 'Waitlist signup',
      amount: 100,
      waitlistPoints: 100,
      createdAt: '2026-02-25T00:00:00.000Z',
    },
  ],
}

describe('accounts/me/points', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    buildAccountTrayPointsForPrivyUserMock.mockResolvedValue(samplePayload)
  })

  it('returns tray payload from Privy-scoped builder', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.signupId).toBe(42)
    expect(res.body?.data?.leaderboardEligible).toBe(true)
    expect(res.body?.data?.points?.total).toBe(150)
    expect(res.body?.data?.rank?.total).toBe(4)
    expect(buildAccountTrayPointsForPrivyUserMock).toHaveBeenCalledWith(expect.anything(), 'did:privy:test', undefined)
  })

  it('returns 401 when Privy verification fails', async () => {
    verifyPrivyForAccountsMock.mockRejectedValueOnce(new Error('Missing Privy auth token'))

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })
})
