import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const buildAgentRegistrationMock = vi.fn()
const publishAgentRegistrationToGroveMock = vi.fn()
const resolveAgentRegistrationKeyMock = vi.fn((payload: any, suffix: string) => `resolved:${suffix}:${payload?.name ?? 'unknown'}`)
const readRequestPrincipalMock = vi.fn()
const getCanonicalOriginMock = vi.fn((_: unknown) => 'https://4626.fun')
const getErc8004PublicOriginMock = vi.fn((_: unknown) => 'https://4626.fun')
const checkRateLimitMock = vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 }))

vi.mock('../../server/_lib/agent/agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => buildAgentRegistrationMock(origin),
}))

vi.mock('../../server/_lib/agent/agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: (params: any) => publishAgentRegistrationToGroveMock(params),
  resolveAgentRegistrationKey: (payload: any, suffix: string) => resolveAgentRegistrationKeyMock(payload, suffix),
}))

vi.mock('../../server/_lib/infra/origin.js', () => ({
  getCanonicalOrigin: (req: any) => getCanonicalOriginMock(req),
  getErc8004PublicOrigin: (req: any) => getErc8004PublicOriginMock(req),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '203.0.113.88'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    agentsWrite: { windowMs: 60_000, maxRequests: 30 },
  },
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>(
    '../../packages/server-core/src/index.js',
  )
  return {
    ...actual,
    readRequestPrincipal: (req: any) => readRequestPrincipalMock(req),
  }
})

describe('v1/agents/publish', () => {
  beforeEach(() => {
    buildAgentRegistrationMock.mockReset()
    publishAgentRegistrationToGroveMock.mockReset()
    resolveAgentRegistrationKeyMock.mockClear()
    readRequestPrincipalMock.mockReset()
    getCanonicalOriginMock.mockReset()
    getErc8004PublicOriginMock.mockReset()
    checkRateLimitMock.mockReset()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 })
    getCanonicalOriginMock.mockReturnValue('https://4626.fun')
    getErc8004PublicOriginMock.mockReturnValue('https://4626.fun')
    readRequestPrincipalMock.mockReturnValue({ type: 'session', address: '0x1111111111111111111111111111111111111111' })
    buildAgentRegistrationMock.mockReturnValue({
      payload: {
        name: '4626 Agent',
        registrations: [{ agentId: 2205, agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432' }],
        services: [{ name: 'web', endpoint: 'https://4626.fun' }],
      },
      missing: [],
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns immutable URI policy details and Grove fallback metadata after publish', async () => {
    publishAgentRegistrationToGroveMock.mockResolvedValue({
      ok: true,
      status: 'stored',
      lensUri: 'lens://registration-key',
      gatewayUrl: 'https://api.grove.storage/registration-key',
      storageKey: 'registration-key',
      payloadHash: 'hash',
      mode: 'on-change',
      pipeline: 'immutable',
    })

    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: true }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      groveStatus: 'stored',
      grove: {
        lensUri: 'lens://registration-key',
        gatewayUrl: 'https://api.grove.storage/registration-key',
      },
      uriPolicy: {
        mode: 'strict-immutable',
        preferredOnchainUriKind: 'data:',
        mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
        domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
        compatibilityFallbackUrl: 'https://api.grove.storage/registration-key',
      },
    })
    expect(String(res.body.data.uriPolicy.preferredOnchainUri)).toMatch(/^data:application\/json;base64,/)
  })

  it('rejects unauthenticated publish requests', async () => {
    readRequestPrincipalMock.mockReturnValue(null)

    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: true }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({
      success: false,
      error: 'Authentication required',
    })
    expect(publishAgentRegistrationToGroveMock).not.toHaveBeenCalled()
  })

  it('returns groveStatus skipped when Grove storage is disabled', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: false }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.groveStatus).toBe('skipped')
    expect(res.body.data.grove).toBeUndefined()
    expect(res.body.data.uriPolicy.compatibilityFallbackUrl).toBeNull()
    expect(publishAgentRegistrationToGroveMock).not.toHaveBeenCalled()
  })

  it('returns groveStatus unavailable and no fallback URL when Grove storage fails', async () => {
    publishAgentRegistrationToGroveMock.mockResolvedValue({
      ok: false,
      status: 'unavailable',
      error: 'grove_unavailable',
    })

    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: true }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.groveStatus).toBe('unavailable')
    expect(res.body.data.grove).toBeUndefined()
    expect(res.body.data.uriPolicy.compatibilityFallbackUrl).toBeNull()
  })

  it('uses the ERC-8004 public origin for mirror URLs even when the request host differs', async () => {
    getCanonicalOriginMock.mockReturnValue('https://preview-4626.vercel.app')
    publishAgentRegistrationToGroveMock.mockResolvedValue({
      ok: true,
      status: 'stored',
      lensUri: 'lens://registration-key',
      gatewayUrl: 'https://api.grove.storage/registration-key',
      storageKey: 'registration-key',
      payloadHash: 'hash',
      mode: 'on-change',
      pipeline: 'immutable',
    })

    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: true }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.uriPolicy.mirrorUrl).toBe('https://4626.fun/.well-known/agent-registration.json')
    expect(res.body.data.uriPolicy.domainVerificationUrl).toBe('https://4626.fun/.well-known/erc8004.json')
  })

  it('returns 429 when publish requests exceed the endpoint rate limit', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })

    const { default: handler } = await import('../_handlers/v1/agents/_publish.ts')
    const req = createMockReq({ method: 'POST', body: { storeOnGrove: true }, url: '/api/v1/agents/publish' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({
      success: false,
      error: 'Rate limit exceeded',
    })
  })
})
