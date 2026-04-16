import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
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

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

describe('/api/social/recipient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 })
  })

  it('requires authentication', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    const mod = await import('../_handlers/social/_recipient.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { address: '0x00000000000000000000000000000000000000bb' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toMatch(/not authenticated/i)
  })

  it('resolves canonical smart wallet for authenticated caller', async () => {
    getDbMock.mockResolvedValue({
      sql: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles p')) {
          return {
            rows: [{
              id: 42,
              primary_smart_wallet: null,
              csw_address: null,
              base_sub_account: null,
            }],
          }
        }
        if (text.includes('from profile_wallets')) {
          return {
            rows: [{ address: '0x00000000000000000000000000000000000000cc' }],
          }
        }
        return { rows: [] }
      },
    })

    const mod = await import('../_handlers/social/_recipient.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { address: '0x00000000000000000000000000000000000000bb' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: {
        inputAddress: '0x00000000000000000000000000000000000000bb',
        recipientAddress: '0x00000000000000000000000000000000000000cc',
      },
    })
  })
})
