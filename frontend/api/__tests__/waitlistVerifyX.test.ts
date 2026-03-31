import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_verify-x.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readSessionFromRequestMock,
  readSiwaAgentFromRequestMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
  verifyAuthTokenMock,
  getUserByIdMock,
  isAuthorizedWalletForProfileMock,
  awardWaitlistPointsMock,
} = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  verifyAuthTokenMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  isAuthorizedWalletForProfileMock: vi.fn(async () => true),
  awardWaitlistPointsMock: vi.fn(async () => true),
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

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { x: 50 },
  awardWaitlistPoints: awardWaitlistPointsMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn(() => ({
    verifyAuthToken: verifyAuthTokenMock,
    getUserById: getUserByIdMock,
  })),
}))

function createResponse(status: number, payload: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
    async text() {
      return typeof payload === 'string' ? payload : JSON.stringify(payload)
    },
  } as any
}

function createDb(params: { profileOwnerAddress: string; profilePrivyUserId?: string | null }) {
  const { profileOwnerAddress, profilePrivyUserId = 'did:privy:123' } = params
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles') && text.includes('where email')) {
        // The email is parameterized, but we don't need to validate values for this unit test.
        void values
        return {
          rows: [
            {
              id: 1,
              border_tier: 0,
              x_follow_verified_at: null,
              primary_wallet: profileOwnerAddress,
              embedded_wallet: null,
              csw_address: null,
              privy_user_id: profilePrivyUserId,
            },
          ],
        }
      }
      if (text.includes('insert into points')) return { rows: [{ id: 123 }] }
      if (text.includes('update profiles') && text.includes('x_follow_verified_at')) return { rows: [{ border_tier: 1 }] }
      return { rows: [] }
    }),
  }
}

describe('waitlist/verify-x', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()

    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({
      PRIVY_APP_ID: 'privy_app',
      PRIVY_APP_SECRET: 'privy_secret',
      TWITTER_BEARER_TOKEN: 'x_bearer_token',
    })

    readSessionFromRequestMock.mockReturnValue({ address: '0x00000000000000000000000000000000000000aa' } as any)
    readSiwaAgentFromRequestMock.mockReturnValue(null)

    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:123' } as any)
    getUserByIdMock.mockResolvedValue({ twitter: { subject: '111', username: 'wenakita' } } as any)
    isAuthorizedWalletForProfileMock.mockResolvedValue(true)

    getDbMock.mockResolvedValue(
      createDb({
        profileOwnerAddress: '0x00000000000000000000000000000000000000aa',
      }) as any,
    )
  })

  it('fails closed when X follow check is blocked by API access', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/users/by/username/') && u.toLowerCase().includes('4626fun')) {
        return createResponse(200, { data: { id: '222', username: '4626fun' } })
      }
      if (u.includes('/users/111/following')) {
        return createResponse(403, {
          errors: [
            {
              message:
                'You currently have access to a subset of X API V2 endpoints and limited v1.1 endpoints (e.g. media post, oauth) only.',
            },
          ],
        })
      }
      return createResponse(500, { error: 'unexpected_url', url: u })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy_token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.verified).toBe(false)
    expect(res.body?.data?.awarded).toBe(false)
    expect(res.body?.data?.borderTier).toBe(0)
  })

  it('awards points only when follow verification succeeds', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/users/by/username/') && u.toLowerCase().includes('4626fun')) {
        return createResponse(200, { data: { id: '222', username: '4626fun' } })
      }
      if (u.includes('/users/111/following')) {
        return createResponse(200, { data: [{ id: '222', username: '4626fun' }], meta: {} })
      }
      return createResponse(500, { error: 'unexpected_url', url: u })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy_token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.verified).toBe(true)
    expect(res.body?.data?.awarded).toBe(true)
    expect(res.body?.data?.borderTier).toBe(1)
  })

  it('rejects when Privy token user does not match bound waitlist profile', async () => {
    getDbMock.mockResolvedValueOnce(
      createDb({
        profileOwnerAddress: '0x00000000000000000000000000000000000000aa',
        profilePrivyUserId: 'did:privy:someone-else',
      }) as any,
    )

    const fetchMock = vi.fn(async () => createResponse(500, { error: 'should_not_call_x_api' }))
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy_token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(403)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Not authorized')
  })
})
