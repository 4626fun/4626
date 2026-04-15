import { createHash } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const REGISTRATION = {
  name: '4626 Agent',
  description: 'Canonical public profile for the 4626 agent.',
  services: [
    { name: 'web', endpoint: 'https://4626.fun' },
    { name: 'api', endpoint: 'https://4626.fun/api/v1/spec.json' },
  ],
  registrations: [
    {
      agentId: 2205,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    },
  ],
}

const REGISTRATION_HASH = createHash('sha256').update(JSON.stringify(REGISTRATION)).digest('hex')

const mocks = vi.hoisted(() => ({
  buildAgentRegistration: vi.fn(),
  getErc8004PublicOrigin: vi.fn(),
  getAgentRegistrationState: vi.fn(),
  publishAgentRegistrationToGrove: vi.fn(),
  resolveAgentRegistrationKey: vi.fn(),
  buildAgentVerificationData: vi.fn(),
}))

vi.mock('./agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => mocks.buildAgentRegistration(origin),
}))

vi.mock('../origin.js', () => ({
  getErc8004PublicOrigin: (req?: unknown) => mocks.getErc8004PublicOrigin(req),
}))

vi.mock('./agentRegistrationState.js', () => ({
  getAgentRegistrationState: (agentKey: string) => mocks.getAgentRegistrationState(agentKey),
}))

vi.mock('./agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: (params: unknown) => mocks.publishAgentRegistrationToGrove(params),
  resolveAgentRegistrationKey: (payload: unknown, fallback?: string) => mocks.resolveAgentRegistrationKey(payload, fallback),
}))

vi.mock('../../../api/_handlers/v1/agents/identity/_verification.ts', () => ({
  buildAgentVerificationData: (req?: unknown) => mocks.buildAgentVerificationData(req),
}))

describe('erc8004OperatorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getErc8004PublicOrigin.mockReturnValue('https://4626.fun')
    mocks.buildAgentRegistration.mockReturnValue({
      payload: REGISTRATION,
      error: null,
      missing: [],
    })
    mocks.resolveAgentRegistrationKey.mockReturnValue('single-csw:0xab6d5c10b03300326cd7fab7267ae192842967b5')
    mocks.buildAgentVerificationData.mockResolvedValue({
      agentId: 2205,
      discoverabilityReady: true,
      checks: [],
    })
  })

  it('reuses matching stored Grove state when building a read-only publish snapshot', async () => {
    mocks.getAgentRegistrationState.mockResolvedValue({
      agentKey: 'single-csw:0xab6d5c10b03300326cd7fab7267ae192842967b5',
      payloadHash: REGISTRATION_HASH,
      lensUri: 'lens://registration-key',
      gatewayUrl: 'https://api.grove.storage/registration-key',
      storageKey: 'registration-key',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })

    const { buildAgentPublishStatus } = await import('./erc8004OperatorStatus.ts')
    const result = await buildAgentPublishStatus({ storeOnGrove: false })

    expect(result.registration).toEqual(REGISTRATION)
    expect(result.publish.groveStatus).toBe('stored')
    expect(result.publish.grove).toEqual({
      lensUri: 'lens://registration-key',
      gatewayUrl: 'https://api.grove.storage/registration-key',
      storageKey: 'registration-key',
      statusUrl: null,
    })
    expect(result.publish.uriPolicy.compatibilityFallbackUrl).toBe('https://api.grove.storage/registration-key')
    expect(mocks.publishAgentRegistrationToGrove).not.toHaveBeenCalled()
  })

  it('derives operator next actions from failed discoverability checks', async () => {
    mocks.getAgentRegistrationState.mockResolvedValue(null)
    mocks.buildAgentVerificationData.mockResolvedValue({
      agentId: 2205,
      discoverabilityReady: false,
      checks: [
        { id: 'token-uri-immutable', passed: false, detail: 'tokenURI must use a strict immutable scheme.' },
        { id: 'canonical-agent-wallet', passed: false, detail: 'agentWallet is not bound to the canonical CSW.' },
        { id: 'registration-mirror', passed: false, detail: 'Registration mirror does not match the canonical payload.' },
        { id: 'service-availability', passed: false, detail: 'Primary public endpoint is unhealthy.' },
      ],
    })

    const { buildAgentOperatorStatus } = await import('./erc8004OperatorStatus.ts')
    const result = await buildAgentOperatorStatus()

    expect(result.nextActions.map((action) => action.id)).toEqual([
      'write_token_uri',
      'set_agent_wallet',
      'repair_mirror',
      'fix_service_endpoint',
      'rerun_discoverability',
    ])
  })
})
