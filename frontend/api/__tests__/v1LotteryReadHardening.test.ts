import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const CREATOR_COIN = '0x1111111111111111111111111111111111111111'

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

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    lotteryRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

describe('v1 lottery read hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
  })

  it('registers static and dynamic lottery read routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')

    await expect(getV1ApiHandler('lottery/global')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('lottery/creator')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler('lottery/recentWinners')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`lottery/creator/${CREATOR_COIN}`)).resolves.toBeTypeOf('function')
  })

  it('returns 429 when lottery read rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const creatorMod = await import('../_handlers/v1/lottery/_creator.ts')
    const creatorReq = createMockReq({ method: 'GET', query: { creatorCoin: CREATOR_COIN } })
    const creatorRes = createMockRes()
    await creatorMod.default(creatorReq, creatorRes)
    expect(creatorRes.statusCode).toBe(429)
    expect(creatorRes.body?.error).toBe('Too many requests')

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const globalMod = await import('../_handlers/v1/lottery/_global.ts')
    const globalReq = createMockReq({ method: 'GET', query: {} })
    const globalRes = createMockRes()
    await globalMod.default(globalReq, globalRes)
    expect(globalRes.statusCode).toBe(429)
    expect(globalRes.body?.error).toBe('Too many requests')

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const winnersMod = await import('../_handlers/v1/lottery/_recentWinners.ts')
    const winnersReq = createMockReq({ method: 'GET', query: {} })
    const winnersRes = createMockRes()
    await winnersMod.default(winnersReq, winnersRes)
    expect(winnersRes.statusCode).toBe(429)
    expect(winnersRes.body?.error).toBe('Too many requests')
  })
})
