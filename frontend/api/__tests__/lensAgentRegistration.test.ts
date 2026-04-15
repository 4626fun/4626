import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VercelRequest, VercelResponse } from '@vercel/node'

const buildAgentRegistrationMock = vi.fn()
const publishAgentRegistrationToGroveMock = vi.fn()
const resolveAgentRegistrationKeyMock = vi.fn((payload: any, suffix: string) => `resolved:${suffix}:${payload?.name ?? 'unknown'}`)
const readRequestPrincipalMock = vi.fn()
const getCanonicalOriginMock = vi.fn((_: unknown) => 'https://4626.fun')
const getErc8004PublicOriginMock = vi.fn((_: unknown) => 'https://4626.fun')

vi.mock('../../server/_lib/agent/agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => buildAgentRegistrationMock(origin),
}))

vi.mock('../../server/_lib/agent/agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: (params: any) => publishAgentRegistrationToGroveMock(params),
  resolveAgentRegistrationKey: (payload: any, suffix: string) => resolveAgentRegistrationKeyMock(payload, suffix),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: (req: any) => getCanonicalOriginMock(req),
  getErc8004PublicOrigin: (req: any) => getErc8004PublicOriginMock(req),
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  readRequestPrincipal: (req: any) => readRequestPrincipalMock(req),
}))

function createMockReq(partial: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: undefined,
    ...partial,
  } as VercelRequest
}

function createMockRes() {
  const res: Partial<VercelResponse> = {}
  res.status = vi.fn().mockImplementation(() => res)
  res.json = vi.fn().mockImplementation(() => res)
  res.setHeader = vi.fn()
  return res as VercelResponse & {
    status: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
    setHeader: ReturnType<typeof vi.fn>
  }
}

describe('lens/agent-registration handler', () => {
  beforeEach(() => {
    buildAgentRegistrationMock.mockReset()
    publishAgentRegistrationToGroveMock.mockReset()
    resolveAgentRegistrationKeyMock.mockClear()
    readRequestPrincipalMock.mockReset()
    getCanonicalOriginMock.mockReset()
    getErc8004PublicOriginMock.mockReset()
    getCanonicalOriginMock.mockReturnValue('https://4626.fun')
    getErc8004PublicOriginMock.mockReturnValue('https://4626.fun')
    buildAgentRegistrationMock.mockReturnValue({
      payload: { name: '4626 Agent', registrations: [], services: [] },
      missing: [],
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('treats bare GET requests as read-only and does not require auth', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(publishAgentRegistrationToGroveMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          registration: expect.any(Object),
          groveStatus: 'skipped',
        }),
      }),
    )
  })

  it('still requires auth when GET explicitly requests store=true', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'GET', query: { store: 'true' } })
    const res = createMockRes()
    readRequestPrincipalMock.mockReturnValue(null)

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(publishAgentRegistrationToGroveMock).not.toHaveBeenCalled()
  })

  it('returns strict immutable URI guidance plus the Grove compatibility fallback after publish', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'POST', body: { store: true } })
    const res = createMockRes()
    readRequestPrincipalMock.mockReturnValue({ type: 'session', address: '0x1234' })
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

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          groveStatus: 'stored',
          grove: expect.objectContaining({
            lensUri: 'lens://registration-key',
            gatewayUrl: 'https://api.grove.storage/registration-key',
          }),
          uriPolicy: expect.objectContaining({
            mode: 'strict-immutable',
            preferredOnchainUriKind: 'data:',
            mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
            domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
            compatibilityFallbackUrl: 'https://api.grove.storage/registration-key',
            preferredOnchainUri: expect.stringMatching(/^data:application\/json;base64,/),
          }),
        }),
      }),
    )
  })

  it('returns groveStatus skipped for authenticated store=false requests', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'POST', body: { store: false } })
    const res = createMockRes()
    readRequestPrincipalMock.mockReturnValue({ type: 'session', address: '0x1234' })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          groveStatus: 'skipped',
          grove: undefined,
          uriPolicy: expect.objectContaining({
            compatibilityFallbackUrl: null,
          }),
        }),
      }),
    )
    expect(publishAgentRegistrationToGroveMock).not.toHaveBeenCalled()
  })

  it('returns groveStatus unavailable and no compatibility fallback when Grove storage fails', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'POST', body: { store: true } })
    const res = createMockRes()
    readRequestPrincipalMock.mockReturnValue({ type: 'session', address: '0x1234' })
    publishAgentRegistrationToGroveMock.mockResolvedValue({
      ok: false,
      status: 'unavailable',
      error: 'grove_unavailable',
    })

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          groveStatus: 'unavailable',
          grove: undefined,
          uriPolicy: expect.objectContaining({
            compatibilityFallbackUrl: null,
          }),
        }),
      }),
    )
  })

  it('keeps the returned mirror URLs pinned to the ERC-8004 public origin when the request host differs', async () => {
    const { default: handler } = await import('../_handlers/lens/_agent-registration.ts')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    getCanonicalOriginMock.mockReturnValue('https://preview-4626.vercel.app')

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          uriPolicy: expect.objectContaining({
            mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
            domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
          }),
        }),
      }),
    )
  })
})
