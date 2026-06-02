import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readRequestPrincipal: vi.fn(),
  buildAgentOperatorStatus: vi.fn(),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '@4626/server-core',
  )
  return {
    ...actual,
    handleOptions: mocks.handleOptions,
    readRequestPrincipal: mocks.readRequestPrincipal,
  }
})

vi.mock('../../server/_lib/agent/erc8004OperatorStatus.js', () => ({
  buildAgentOperatorStatus: (req?: unknown) => mocks.buildAgentOperatorStatus(req),
}))

describe('v1/agents/operator-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readRequestPrincipal.mockReturnValue({ type: 'session', address: '0x1111111111111111111111111111111111111111' })
    mocks.buildAgentOperatorStatus.mockResolvedValue({
      registration: {
        name: '4626 Agent',
        registrations: [{ agentId: 2205, agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432' }],
      },
      publish: {
        groveStatus: 'stored',
        uriPolicy: {
          mode: 'strict-immutable',
          preferredOnchainUri: 'data:application/json;base64,abc',
          preferredOnchainUriKind: 'data:',
          preferredSchemes: ['data:', 'ipfs://', 'ar://'],
          mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
          domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
          compatibilityFallbackUrl: 'https://api.grove.storage/registration-key',
          writeOnchainHint: 'Write the strict immutable URI onchain.',
        },
        grove: {
          lensUri: 'lens://registration-key',
          gatewayUrl: 'https://api.grove.storage/registration-key',
          storageKey: 'registration-key',
          statusUrl: null,
        },
      },
      discoverability: {
        agentId: 2205,
        discoverabilityReady: false,
        checks: [
          { id: 'canonical-agent-wallet', passed: false, detail: 'agentWallet is not bound to the canonical CSW.' },
        ],
      },
      nextActions: [
        {
          id: 'set_agent_wallet',
          label: 'Bind agentWallet to the canonical CSW',
          detail: 'agentWallet is not bound to the canonical CSW.',
        },
      ],
      checkedAt: '2026-04-07T00:00:00.000Z',
    })
  })

  it('requires authentication', async () => {
    mocks.readRequestPrincipal.mockReturnValue(null)

    const { default: handler } = await import('../_handlers/v1/agents/_operator-status.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/operator-status' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({
      success: false,
      error: 'Authentication required',
    })
    expect(mocks.buildAgentOperatorStatus).not.toHaveBeenCalled()
  })

  it('returns the operator snapshot for authenticated GET requests', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_operator-status.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/operator-status' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.publish.groveStatus).toBe('stored')
    expect(res.body.data.discoverability.agentId).toBe(2205)
    expect(res.body.data.nextActions.map((action: { id: string }) => action.id)).toEqual(['set_agent_wallet'])
    expect(mocks.buildAgentOperatorStatus).toHaveBeenCalledWith(req)
  })

  it('surfaces shared builder errors with statusCode and missing fields', async () => {
    mocks.buildAgentOperatorStatus.mockRejectedValue(
      Object.assign(new Error('Missing ERC-8004 registry configuration.'), {
        statusCode: 503,
        missing: ['ERC8004_AGENT_ID'],
      }),
    )

    const { default: handler } = await import('../_handlers/v1/agents/_operator-status.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/operator-status' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      success: false,
      error: 'Missing ERC-8004 registry configuration.',
      missing: ['ERC8004_AGENT_ID'],
    })
  })

  it('is wired into the v1 route map', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    await expect(getV1ApiHandler('agents/operator-status')).resolves.toBeTypeOf('function')
  })
})
