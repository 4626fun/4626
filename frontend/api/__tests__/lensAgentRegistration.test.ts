import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VercelRequest, VercelResponse } from '@vercel/node'

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

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
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
    getCanonicalOriginMock.mockReturnValue('https://4626.fun')
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
})
