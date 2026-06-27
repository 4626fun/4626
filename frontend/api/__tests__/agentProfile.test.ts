import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const CANONICAL_CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
const IDENTITY_REGISTRY = 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'

const canonicalRegistration = {
  name: '4626 Agent',
  description: 'Canonical public profile for the 4626 agent.',
  image: 'https://4626.fun/assets/logo-mark-1024.png',
  active: true,
  x402Support: true,
  reputationRegistry: 'eip155:8453:0x8004baa17c55a88189ae136b182e5fda19de9b63',
  supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
  services: [
    { name: 'web', endpoint: 'https://4626.fun' },
    { name: 'feedback', endpoint: 'https://4626.fun/api/v1/agents/feedback' },
    { name: 'wallet-intelligence', endpoint: 'https://4626.fun/api/v1/agents/wallet-intelligence' },
  ],
  registrations: [
    {
      agentId: 2205,
      agentRegistry: IDENTITY_REGISTRY,
    },
  ],
}

const verificationData = {
  chainId: 8453,
  registryAddress: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  agentId: 2205,
  canonicalCsw: CANONICAL_CSW,
  ownerAddress: '0x742d35cc6634c0532925a3b844bc9e7595f2bd18',
  agentWallet: CANONICAL_CSW,
  tokenUri: 'data:application/json;base64,abc',
  agentRegistered: true,
  walletBoundToCanonical: true,
  discoverabilityReady: true,
  tokenUriIsStrictImmutable: true,
  tokenUriMatchesCanonical: true,
  uriPolicy: {
    mode: 'strict-immutable',
    preferredOnchainUri: 'data:application/json;base64,abc',
    preferredOnchainUriKind: 'data:',
    preferredSchemes: ['data:', 'ipfs://', 'ar://'],
    mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
    domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
    writeOnchainHint: 'Write the strict immutable URI onchain.',
    compatibilityFallbackUrl: null,
  },
  endpoint: {
    url: 'https://4626.fun/api/v1/spec.json',
    ok: true,
    status: 200,
    error: null,
  },
  mirrors: {
    registration: {
      url: 'https://4626.fun/.well-known/agent-registration.json',
      reachable: true,
      finalUrl: 'https://4626.fun/.well-known/agent-registration.json',
      matchesCanonical: true,
      agentIdMatches: true,
      error: null,
    },
    domainVerification: {
      url: 'https://4626.fun/.well-known/erc8004.json',
      reachable: true,
      finalUrl: 'https://4626.fun/.well-known/erc8004.json',
      matchesCanonical: true,
      error: null,
    },
  },
  checks: [],
  links: {
    registry: 'https://basescan.org/address/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
    token: 'https://basescan.org/token/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432?a=2205',
    canonicalCsw: `https://basescan.org/address/${CANONICAL_CSW}`,
    ownerAddress: 'https://basescan.org/address/0x742d35cc6634c0532925a3b844bc9e7595f2bd18',
    agentWallet: `https://basescan.org/address/${CANONICAL_CSW}`,
  },
  rpcHealthy: true,
  rpcErrorCount: 0,
}

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  getErc8004PublicOrigin: vi.fn(() => 'https://4626.fun'),
  buildAgentRegistration: vi.fn(),
  buildAgentVerificationData: vi.fn(),
  buildReputationGraph: vi.fn(),
  queryFeedbackIndex: vi.fn(),
  buildWalletIntelligence: vi.fn(),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '@4626/server-core',
  )
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    handleOptions: mocks.handleOptions,
    guardAgentApiRequest: mocks.guardAgentApiRequest,
  }
})

vi.mock('../../server/_lib/infra/origin.js', () => ({
  getErc8004PublicOrigin: () => mocks.getErc8004PublicOrigin(),
}))

vi.mock('../../server/_lib/agent/agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => mocks.buildAgentRegistration(origin),
}))

vi.mock('../_handlers/v1/agents/identity/_verification.ts', async () => {
  const actual = await vi.importActual<typeof import('../_handlers/v1/agents/identity/_verification.ts')>(
    '../_handlers/v1/agents/identity/_verification.ts',
  )
  return {
    ...actual,
    buildAgentVerificationData: (req?: unknown) => mocks.buildAgentVerificationData(req),
  }
})

vi.mock('../../server/_lib/lens/reputationGraph.js', () => ({
  buildReputationGraph: (params: unknown) => mocks.buildReputationGraph(params),
}))

vi.mock('../../server/_lib/wallet/walletIntelligenceCache.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/wallet/walletIntelligenceCache.js')>(
    '../../server/_lib/wallet/walletIntelligenceCache.js',
  )
  return {
    ...actual,
    queryFeedbackIndex: (params: unknown) => mocks.queryFeedbackIndex(params),
  }
})

vi.mock('../../server/_lib/wallet/walletIntelligence.js', () => ({
  buildWalletIntelligence: (address: string, options?: unknown) => mocks.buildWalletIntelligence(address, options),
}))

describe('v1/agents/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.getErc8004PublicOrigin.mockReturnValue('https://4626.fun')
    mocks.buildAgentRegistration.mockReturnValue({
      payload: canonicalRegistration,
      error: null,
      missing: [],
    })
    mocks.buildAgentVerificationData.mockResolvedValue(verificationData)
    mocks.buildReputationGraph.mockResolvedValue({
      agentId: 2205,
      agentRegistry: IDENTITY_REGISTRY,
      reputationRegistry: canonicalRegistration.reputationRegistry,
      chainId: 8453,
      nodes: [],
      edges: [],
      groups: [],
      summary: {
        totalFeedback: 3,
        totalReviewers: 2,
        averageValue: '4.5',
        averageValueDecimals: 1,
        label: 'Good',
      },
      generatedAt: '2026-04-07T00:00:00.000Z',
      source: 'erc8004.reputation-graph.v1',
    })
    mocks.queryFeedbackIndex.mockResolvedValue({
      entries: [
        {
          id: 1,
          agentId: 2205,
          clientAddress: '0x4444444444444444444444444444444444444444',
          feedbackIndex: 7,
          value: 45,
          valueDecimals: 1,
          tag1: 'technical-review',
          tag2: 'good',
          endpoint: 'https://4626.fun/api/v1/spec.json',
          feedbackUri: 'lens://review-feedback',
          feedbackHash: '0xfeedbeef',
          groveUri: 'lens://review-grove',
          isRevoked: false,
          reasoning: 'Thorough technical review',
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:00:00.000Z',
        },
      ],
      total: 1,
    })
    mocks.buildWalletIntelligence.mockResolvedValue({
      target: CANONICAL_CSW,
      canonicalWallet: CANONICAL_CSW,
      nodes: [{ id: 'wallet', type: 'wallet', label: CANONICAL_CSW, data: {} }],
      edges: [],
      groups: [],
      sources: {
        funderTrace: { chain: [{ hop: 1 }] },
        labels: {
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': {
            isKnownEntity: true,
            labels: [{ name: 'Coinbase' }],
          },
        },
        portfolio: { totalUsdValue: 42000 },
        ens: { name: 'agent.eth' },
        lens: { handle: 'agent4626' },
        basename: null,
      },
      generatedAt: '2026-04-07T00:00:00.000Z',
      source: 'wallet-intelligence.v1',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns discovery metadata for bare GET requests', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_profile.ts')
    const req = createMockReq({ method: 'GET', query: {}, url: '/api/v1/agents/profile' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.endpoint).toBe('/api/v1/agents/profile')
    expect(res.body.data.requiredQuery).toContain('agentId')
  })

  it('rejects agent IDs that do not match the configured canonical agent', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_profile.ts')
    const req = createMockReq({
      method: 'GET',
      query: { agentId: '9999' },
      url: '/api/v1/agents/profile?agentId=9999',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(String(res.body.error)).toContain('canonical agent')
  })

  it('returns a consolidated public profile built from verification, reputation, review artifacts, and wallet intelligence', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_profile.ts')
    const req = createMockReq({
      method: 'GET',
      query: { agentId: '2205' },
      url: '/api/v1/agents/profile?agentId=2205',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.agentId).toBe(2205)
    expect(res.body.data.discoverability.discoverabilityReady).toBe(true)
    expect(res.body.data.feedback.summary.totalFeedback).toBe(3)
    expect(res.body.data.feedback.latestReviewArtifact.feedbackGatewayUrl).toBe('https://api.grove.storage/review-feedback')
    expect(res.body.data.feedback.latestReviewArtifact.groveGatewayUrl).toBe('https://api.grove.storage/review-grove')
    expect(res.body.data.reputation.endpoint).toBe('https://4626.fun/api/lens/reputation-graph?agentId=2205&store=false')
    expect(res.body.data.walletIntelligence.endpoint).toBe(
      `https://4626.fun/api/v1/agents/wallet-intelligence?address=${CANONICAL_CSW}&store=false`,
    )
    expect(res.body.data.walletIntelligence.summary.netWorth).toBe(42000)
    expect(res.body.data.advertisedServices).toHaveLength(3)
    expect(res.body.data.domainProof.verifiedEndpoints).toContain('https://4626.fun/api/v1/agents/wallet-intelligence')
    expect(mocks.buildWalletIntelligence).toHaveBeenCalledWith(CANONICAL_CSW, undefined)
  })
})
