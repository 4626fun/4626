import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const buildAgentRegistrationMock = vi.fn()
const publishAgentRegistrationToGroveMock = vi.fn()
const resolveAgentRegistrationKeyMock = vi.fn((payload: any, suffix: string) => `resolved:${suffix}:${payload?.name ?? 'unknown'}`)
const readRequestPrincipalMock = vi.fn()
const getCanonicalOriginMock = vi.fn((_: unknown) => 'https://4626.fun')

vi.mock('../../server/_lib/agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => buildAgentRegistrationMock(origin),
}))

vi.mock('../../server/_lib/agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: (params: any) => publishAgentRegistrationToGroveMock(params),
  resolveAgentRegistrationKey: (payload: any, suffix: string) => resolveAgentRegistrationKeyMock(payload, suffix),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: (req: any) => getCanonicalOriginMock(req),
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
    getCanonicalOriginMock.mockReturnValue('https://4626.fun')
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
})
