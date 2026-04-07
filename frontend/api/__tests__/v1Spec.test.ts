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

  async function renderSpec() {
    const mod = await import('../_handlers/v1/_spec.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'GET', headers: { host: 'v1.4626.fun' } })
    const res = createMockRes()

    await handler(req, res)
    expect(res.statusCode).toBe(200)
    return res.body
  }

  it('includes token metadata, image, logo aliases, token list routes, and the paid ERC-8004 review route', async () => {
    const body = await renderSpec()

    expect(body?.paths?.['/v1/token/{address}/metadata']).toBeTruthy()
    expect(body?.paths?.['/v1/token/{address}/image']).toBeTruthy()
    expect(body?.paths?.['/v1/token/{address}/logo.png']).toBeTruthy()
    expect(body?.paths?.['/v1/token/{address}/logo.svg']).toBeTruthy()
    expect(body?.paths?.['/v1/token/{address}/tokenlist']).toBeTruthy()
    expect(body?.paths?.['/v1/explore/vaults']).toBeTruthy()
    expect(body?.paths?.['/v1/agents/feedback/review']).toBeTruthy()
    expect(body?.paths?.['/v1/agents/identity/verification']?.get?.summary).toContain('discoverability')
  })

  it('advertises the live public agent directory, publish, feedback, wallet-intelligence, and Lens helper surfaces', async () => {
    const body = await renderSpec()

    expect(body?.paths?.['/agents']?.get?.summary).toContain('agent')
    expect(body?.paths?.['/v1/agents/profile']?.get?.summary).toContain('profile')
    expect(body?.paths?.['/v1/agents/feedback']?.get?.parameters.map((parameter: { name: string }) => parameter.name)).toContain('agentId')
    expect(body?.paths?.['/v1/agents/wallet-intelligence']?.get?.parameters.map((parameter: { name: string }) => parameter.name)).toContain('address')
    expect(body?.paths?.['/v1/agents/wallet-intelligence']?.post).toBeTruthy()
    expect(body?.paths?.['/v1/agents/publish']?.post?.summary).toContain('publish')
    expect(body?.paths?.['/lens/agent-registration']?.get).toBeTruthy()
    expect(body?.paths?.['/lens/agent-registration']?.post).toBeTruthy()
    expect(body?.paths?.['/lens/reputation-graph']?.get).toBeTruthy()
    expect(body?.paths?.['/lens/reputation-graph']?.post).toBeTruthy()
    expect(body?.paths?.['/lens/feedback-payload']?.get).toBeTruthy()
    expect(body?.paths?.['/lens/feedback-payload']?.post).toBeTruthy()
  })
})
