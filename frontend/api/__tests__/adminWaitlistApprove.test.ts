import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/admin/waitlist/_approve.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readBoundedJsonObjectBodyMock,
  getDbMock,
  getSessionAddressMock,
  isAdminAddressMock,
  checkRateLimitMock,
  ensureWaitlistSchemaMock,
  logAdminActionMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: { body?: unknown }) => req.body ?? {}),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: { body?: unknown }) => req.body ?? {}),
  getDbMock: vi.fn(),
  getSessionAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  isAdminAddressMock: vi.fn(() => true),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  logAdminActionMock: vi.fn(async () => {}),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  getDb: getDbMock,
  isDbConfigured: vi.fn(() => true),
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getClientIp: vi.fn(() => '127.0.0.1'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/admin/adminAudit.js', () => ({
  logAdminAction: logAdminActionMock,
}))

vi.mock('../../server/_lib/messaging/creatorXmtpAgents.js', () => ({
  enableCswAgent: vi.fn(),
  getOrCreateCreatorXmtpAgent: vi.fn(),
}))

describe('POST /api/admin/waitlist/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readJsonBodyMock.mockImplementation(async (req: { body?: unknown }) => req.body ?? {})
    readBoundedJsonObjectBodyMock.mockImplementation(async (req: { body?: unknown }) => req.body ?? {})
    getSessionAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    isAdminAddressMock.mockReturnValue(true)
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })
  })

  it('approves app access without mutating the deploy allowlist', async () => {
    const queryMock = vi.fn(async (sql: string) => {
      const text = String(sql).toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('update profiles')) {
        return {
          rows: [
            {
              id: 7,
              primary_wallet: '0x00000000000000000000000000000000000000bb',
              csw_address: null,
              preprov_server_wallet_id: null,
              preprov_server_wallet_address: null,
              preprov_coin_address: null,
              preprov_coin_symbol: null,
            },
          ],
        }
      }
      throw new Error(`unexpected_query:${text}`)
    })
    const sqlMock = vi.fn(async () => {
      throw new Error('unexpected_allowlist_mutation')
    })

    getDbMock.mockResolvedValue({ query: queryMock, sql: sqlMock })

    const req = createMockReq({
      method: 'POST',
      body: { id: 7, note: 'Approved for app access' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      id: 7,
      status: 'approved',
      allowlisted: false,
      agentEnabled: false,
    })
    expect(sqlMock).not.toHaveBeenCalled()
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'waitlist_approve',
        details: expect.objectContaining({
          allowlisted: false,
          agentEnabled: false,
        }),
      }),
    )
  })

  it('returns 429 when admin action rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    getDbMock.mockResolvedValue({ query: vi.fn(), sql: vi.fn() })

    const req = createMockReq({
      method: 'POST',
      body: { id: 7 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ success: false, error: 'Too many requests' })
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(readJsonBodyMock).not.toHaveBeenCalled()
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects non-object bodies', async () => {
    getDbMock.mockResolvedValue({ query: vi.fn(), sql: vi.fn() })
    readJsonBodyMock.mockResolvedValueOnce(['bad'])

    const req = createMockReq({
      method: 'POST',
      body: ['bad'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Missing id')
  })
})
