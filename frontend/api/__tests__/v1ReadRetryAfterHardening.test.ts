import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getDb: vi.fn(async () => null),
  isDbConfigured: vi.fn(() => true),
  ensureCreatorMetricsSchema: vi.fn(async () => undefined),
  ensureKeeprSchema: vi.fn(async () => undefined),
  resolveAgentCapabilityResponse: vi.fn(async () => ({})),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  guardAgentApiRequest: mocks.guardAgentApiRequest,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  getDb: mocks.getDb,
  isDbConfigured: mocks.isDbConfigured,
  RATE_LIMITS: {
    exploreRead: { windowMs: 60_000, maxRequests: 120 },
    agentsRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

vi.mock('../../server/_lib/creatorMetricsSync.js', () => ({
  ensureCreatorMetricsSchema: mocks.ensureCreatorMetricsSchema,
}))

vi.mock('../../server/_lib/keeprSchema.js', () => ({
  ensureKeeprSchema: mocks.ensureKeeprSchema,
}))

vi.mock('../../server/_lib/agentAccessResolver.js', () => ({
  resolveAgentCapabilityResponse: mocks.resolveAgentCapabilityResponse,
}))

import agentsCapabilitiesHandler from '../_handlers/v1/agents/_capabilities.ts'
import exploreVaultsHandler from '../_handlers/v1/explore/_vaults.ts'

describe('v1 read endpoint Retry-After hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 + Retry-After for /v1/agents/capabilities', async () => {
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x1111111111111111111111111111111111111111',
        chainId: '8453',
      },
    })
    const res = createMockRes()
    await agentsCapabilitiesHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/explore/vaults', async () => {
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await exploreVaultsHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
