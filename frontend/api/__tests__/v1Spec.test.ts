import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  getCanonicalOrigin: vi.fn(() => 'https://api.4626.fun'),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: mocks.getCanonicalOrigin,
}))

describe('v1 spec endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.getCanonicalOrigin.mockReturnValue('https://api.4626.fun')
  })

  it('includes token metadata, image, logo aliases, token list routes, and the paid ERC-8004 review route', async () => {
    const mod = await import('../_handlers/v1/_spec.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'GET', headers: { host: 'app.4626.fun' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.paths?.['/v1/token/{address}/metadata']).toBeTruthy()
    expect(res.body?.paths?.['/v1/token/{address}/image']).toBeTruthy()
    expect(res.body?.paths?.['/v1/token/{address}/logo.png']).toBeTruthy()
    expect(res.body?.paths?.['/v1/token/{address}/logo.svg']).toBeTruthy()
    expect(res.body?.paths?.['/v1/token/{address}/tokenlist']).toBeTruthy()
    expect(res.body?.paths?.['/v1/agents/feedback/review']).toBeTruthy()
  })
})
