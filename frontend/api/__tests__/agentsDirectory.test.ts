import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  getCanonicalOrigin: vi.fn(() => 'https://4626.fun'),
  getErc8004PublicOrigin: vi.fn(() => 'https://4626.fun'),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: mocks.getCanonicalOrigin,
  getErc8004PublicOrigin: mocks.getErc8004PublicOrigin,
}))

describe('/api/agents directory hints', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      ERC8004_AGENT_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      ERC8004_AGENT_CHAIN_ID: '8453',
      ERC8004_AGENT_ID: '2205',
      XMTP_AGENT_CSW_ADDRESS: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('advertises the strict immutable URI strategy and public mirror URLs', async () => {
    const { default: handler } = await import('../_handlers/_agents.ts')
    const req = createMockReq({ method: 'GET', url: '/api/agents' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.byo).toMatchObject({
      registrationUrlTemplate: 'https://{your-domain}/.well-known/agent-registration.json',
      registrationMirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
      domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
      agentUriService: 'https://4626.fun/api/lens/agent-registration',
    })
    expect(String(res.body.byo.agentUriHint)).toContain('strict immutable')
    expect(String(res.body.byo.agentUriHint)).toContain('/.well-known/agent-registration.json')
    expect(String(res.body.byo.agentUriHint)).toContain('compatibility fallback')
  })

  it('keeps discoverability hints pinned to the ERC-8004 public origin even when the request host differs', async () => {
    mocks.getCanonicalOrigin.mockReturnValue('https://preview-4626.vercel.app')

    const { default: handler } = await import('../_handlers/_agents.ts')
    const req = createMockReq({ method: 'GET', url: '/api/agents' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.byo.registrationMirrorUrl).toBe('https://4626.fun/.well-known/agent-registration.json')
    expect(res.body.byo.domainVerificationUrl).toBe('https://4626.fun/.well-known/erc8004.json')
    expect(res.body.byo.agentUriService).toBe('https://4626.fun/api/lens/agent-registration')
    expect(res.body.erc8004.registrationUrl).toBe('https://4626.fun/.well-known/agent-registration.json')
  })
})
