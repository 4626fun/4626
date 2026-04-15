import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const VAULT = '0x9999999999999999999999999999999999999999'
const USER = '0x1111111111111111111111111111111111111111'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    vaultRead: { windowMs: 60_000, maxRequests: 120 },
    ve4626Read: { windowMs: 60_000, maxRequests: 120 },
  },
}))

describe('v1 vault and ve4626 read hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
  })

  it('registers static and dynamic vault/ve4626 routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    await expect(getV1ApiHandler('vault/report')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('vault/strategies')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`vault/${VAULT}/report`)).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`vault/${VAULT}/strategies`)).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('ve4626/user')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`ve4626/user/${USER}`)).resolves.toBeTypeOf('function')
  })

  it('returns 429 when vault/ve4626 read rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const reportMod = await import('../_handlers/v1/vault/_report.ts')
    const reportReq = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const reportRes = createMockRes()
    await reportMod.default(reportReq, reportRes)
    expect(reportRes.statusCode).toBe(429)
    expect(reportRes.body?.error).toBe('Too many requests')
    expect(Number(reportRes.getHeader('retry-after'))).toBeGreaterThan(0)

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const strategiesMod = await import('../_handlers/v1/vault/_strategies.ts')
    const strategiesReq = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const strategiesRes = createMockRes()
    await strategiesMod.default(strategiesReq, strategiesRes)
    expect(strategiesRes.statusCode).toBe(429)
    expect(strategiesRes.body?.error).toBe('Too many requests')
    expect(Number(strategiesRes.getHeader('retry-after'))).toBeGreaterThan(0)

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const veUserMod = await import('../_handlers/v1/ve4626/_user.ts')
    const veUserReq = createMockReq({ method: 'GET', query: { user: USER } })
    const veUserRes = createMockRes()
    await veUserMod.default(veUserReq, veUserRes)
    expect(veUserRes.statusCode).toBe(429)
    expect(veUserRes.body?.error).toBe('Too many requests')
    expect(Number(veUserRes.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
