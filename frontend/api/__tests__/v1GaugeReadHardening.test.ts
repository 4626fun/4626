import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

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

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    gaugeRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

describe('v1 gauge read hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
  })

  it('registers static and dynamic gauge routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    await expect(getV1ApiHandler('gauge/epoch')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('gauge/vaults')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('gauge/user')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`gauge/${USER}/user`)).resolves.toBeNull()
  })

  it('returns 429 when gauge read rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const epochMod = await import('../_handlers/v1/gauge/_epoch.ts')
    const epochReq = createMockReq({ method: 'GET', query: {} })
    const epochRes = createMockRes()
    await epochMod.default(epochReq, epochRes)
    expect(epochRes.statusCode).toBe(429)
    expect(epochRes.body?.error).toBe('Too many requests')
    expect(Number(epochRes.getHeader('retry-after'))).toBeGreaterThan(0)

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const userMod = await import('../_handlers/v1/gauge/_user.ts')
    const userReq = createMockReq({ method: 'GET', query: { user: USER } })
    const userRes = createMockRes()
    await userMod.default(userReq, userRes)
    expect(userRes.statusCode).toBe(429)
    expect(userRes.body?.error).toBe('Too many requests')
    expect(Number(userRes.getHeader('retry-after'))).toBeGreaterThan(0)

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const vaultsMod = await import('../_handlers/v1/gauge/_vaults.ts')
    const vaultsReq = createMockReq({ method: 'GET', query: {} })
    const vaultsRes = createMockRes()
    await vaultsMod.default(vaultsReq, vaultsRes)
    expect(vaultsRes.statusCode).toBe(429)
    expect(vaultsRes.body?.error).toBe('Too many requests')
    expect(Number(vaultsRes.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
