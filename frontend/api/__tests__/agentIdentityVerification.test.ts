import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const CANONICAL_CSW = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'
const ONCHAIN_OWNER = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'
const NON_CANONICAL_WALLET = '0x1111111111111111111111111111111111111111'
const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const MIRROR_URL = 'https://4626.fun/.well-known/agent-registration.json'
const DOMAIN_PROOF_URL = 'https://4626.fun/.well-known/erc8004.json'
const API_ENDPOINT_URL = 'https://4626.fun/api/v1/spec.json'

const canonicalRegistration = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: '4626 Agent',
  description:
    'Agent API for 4626 on Base. Reachable via XMTP messaging, REST API, and MCP tools. Provides vault management, wallet intelligence, ERC-8004 reputation queries, and keeper automation.',
  image: 'https://4626.fun/logo/icon-transparent-512.png',
  services: [
    { name: 'web', endpoint: 'https://4626.fun' },
    {
      name: 'XMTP',
      endpoint: 'https://xmtp.chat/dm/0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      version: 'production',
      address: CANONICAL_CSW,
    },
    {
      name: 'agentWallet',
      endpoint: 'eip155:8453:0xab6d5c10b03300326cd7fab7267ae192842967b5',
      account: 'eip155:8453:0xab6d5c10b03300326cd7fab7267ae192842967b5',
      explorer: 'https://basescan.org/address/0xab6d5c10b03300326cd7fab7267ae192842967b5',
    },
    { name: 'api', endpoint: API_ENDPOINT_URL, version: '1.0.0' },
    { name: 'feedback', endpoint: 'https://4626.fun/api/v1/agents/feedback', version: '2.0' },
  ],
  x402Support: true,
  active: true,
  registrations: [{ agentId: 2205, agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432' }],
  reputationRegistry: 'eip155:8453:0x8004baa17c55a88189ae136b182e5fda19de9b63',
  supportedTrust: ['reputation', 'crypto-economic', 'tee-attestation'],
}

const canonicalDomainProof = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#domain-verification-v1',
  domain: '4626.fun',
  agentId: 2205,
  agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  verifiedEndpoints: [
    'https://4626.fun',
    'https://4626.fun/api/v1/spec.json',
    'https://4626.fun/api/v1/agents/feedback',
    'https://4626.fun/api/lens/reputation-graph',
    'https://4626.fun/api/lens/feedback-payload',
    'https://4626.fun/api/v1/agents/wallet-intelligence',
  ],
  registrationUrl: MIRROR_URL,
  generatedAt: '2026-04-07T00:00:00.000Z',
}

const canonicalDataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(canonicalRegistration)).toString('base64')}`

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  buildAgentRegistration: vi.fn(),
  getCanonicalOrigin: vi.fn(() => 'https://4626.fun'),
  getErc8004PublicOrigin: vi.fn(() => 'https://4626.fun'),
  getTeeAttestationStatus: vi.fn(async () => ({
    enabled: false,
    passed: false,
    reason: 'disabled',
    source: 'validation-registry' as const,
    tag: 'tee-attestation',
    registryAddress: null,
    validatorAddresses: [],
    validationCount: 0,
    averageResponse: 0,
    checkedAtMs: 1,
  })),
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  createPublicClient: vi.fn(),
  http: vi.fn((url: string) => ({ url })),
  fetch: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: mocks.lookup as unknown as typeof import('node:dns/promises').lookup,
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>(
    '../../packages/server-core/src/index.js',
  )
  return {
    ...actual,
    handleOptions: mocks.handleOptions,
    guardAgentApiRequest: mocks.guardAgentApiRequest,
  }
})

vi.mock('../../server/_lib/agent/agentRegistration.js', () => ({
  buildAgentRegistration: (origin: string) => mocks.buildAgentRegistration(origin),
}))

vi.mock('../../server/_lib/infra/origin.js', () => ({
  getCanonicalOrigin: mocks.getCanonicalOrigin as unknown as typeof import('../../server/_lib/infra/origin.js').getCanonicalOrigin,
  getErc8004PublicOrigin: mocks.getErc8004PublicOrigin as unknown as typeof import('../../server/_lib/infra/origin.js').getErc8004PublicOrigin,
}))

vi.mock('../../server/_lib/agent/teeAttestationGate.js', () => ({
  getTeeAttestationStatus: () => mocks.getTeeAttestationStatus(),
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: mocks.createPublicClient as unknown as typeof import('viem').createPublicClient,
    http: mocks.http as unknown as typeof import('viem').http,
  }
})

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
  mainnet: { id: 1 },
}))

function jsonResponse(payload: unknown, status: number = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {}),
    },
  })
}

function textResponse(body: string, status: number = 200, headers?: Record<string, string>) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...(headers ?? {}),
    },
  })
}

function installPublicClient(params?: { tokenUri?: string | null; agentWallet?: string | null; ownerAddress?: string | null }) {
  const tokenUri = params && 'tokenUri' in params ? params.tokenUri : canonicalDataUri
  const agentWallet = params && 'agentWallet' in params ? params.agentWallet : CANONICAL_CSW
  const ownerAddress = params && 'ownerAddress' in params ? params.ownerAddress : ONCHAIN_OWNER

  mocks.createPublicClient.mockReturnValue({
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'getVersion':
          return '1'
        case 'ownerOf':
          if (!ownerAddress) throw new Error('missing owner')
          return ownerAddress
        case 'getAgentWallet':
          return agentWallet ?? '0x0000000000000000000000000000000000000000'
        case 'tokenURI':
          if (!tokenUri) throw new Error('missing token URI')
          return tokenUri
        default:
          throw new Error(`Unexpected contract read: ${functionName}`)
      }
    }),
  })
}

function installFetch(params?: {
  mirrorRegistration?: unknown
  domainProof?: unknown
  endpointStatus?: number
  tokenUriUrl?: string
  tokenUriPayload?: unknown
}) {
  const mirrorRegistration = params?.mirrorRegistration ?? canonicalRegistration
  const domainProof = params?.domainProof ?? canonicalDomainProof
  const endpointStatus = params?.endpointStatus ?? 200
  const tokenUriUrl = params?.tokenUriUrl ?? null
  const tokenUriPayload = params?.tokenUriPayload ?? canonicalRegistration

  mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === MIRROR_URL) return jsonResponse(mirrorRegistration)
    if (url === DOMAIN_PROOF_URL) return jsonResponse(domainProof)
    if (url === API_ENDPOINT_URL) return textResponse('ok', endpointStatus, { 'content-type': 'application/json' })
    if (tokenUriUrl && url === tokenUriUrl) return jsonResponse(tokenUriPayload)
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

describe('v1/agents/identity/verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.buildAgentRegistration.mockReturnValue({
      payload: canonicalRegistration,
      missing: [],
      error: null,
    })
    mocks.getCanonicalOrigin.mockReturnValue('https://4626.fun')
    mocks.getErc8004PublicOrigin.mockReturnValue('https://4626.fun')
    installPublicClient()
    installFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports scanner-ready status when onchain URI, mirrors, and service health all agree', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.discoverabilityReady).toBe(true)
    expect(res.body.data.walletBoundToCanonical).toBe(true)
    expect(res.body.data.tokenUriIsStrictImmutable).toBe(true)
    expect(res.body.data.tokenUriMatchesCanonical).toBe(true)
    expect(res.body.data.mirrors.registration.matchesCanonical).toBe(true)
    expect(res.body.data.mirrors.domainVerification.matchesCanonical).toBe(true)
    expect(res.body.data.endpoint.ok).toBe(true)
    expect(res.body.data.checks.map((check: { id: string }) => check.id)).toEqual(
      expect.arrayContaining([
        'onchain-registration',
        'token-uri-reachable',
        'token-uri-immutable',
        'token-uri-matches-canonical',
        'canonical-agent-wallet',
        'registration-mirror',
        'domain-proof',
        'service-availability',
      ]),
    )
  })

  it('uses the canonical ERC-8004 public origin even when the request resolves to a preview host', async () => {
    mocks.getCanonicalOrigin.mockReturnValue('https://preview-4626.vercel.app')

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.mirrors.registration.url).toBe(MIRROR_URL)
    expect(res.body.data.mirrors.domainVerification.url).toBe(DOMAIN_PROOF_URL)
    expect(res.body.data.uriPolicy.mirrorUrl).toBe(MIRROR_URL)
    expect(res.body.data.discoverabilityReady).toBe(true)
  })

  it('fails discoverability when tokenURI is missing even if both mirrors still match', async () => {
    installPublicClient({ tokenUri: null })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const tokenUriCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'token-uri-reachable')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.mirrors.registration.matchesCanonical).toBe(true)
    expect(tokenUriCheck?.passed).toBe(false)
    expect(tokenUriCheck?.detail).toContain('tokenURI')
  })

  it('fails discoverability when tokenURI uses a mutable https URL even if the payload matches', async () => {
    const tokenUriUrl = 'https://api.grove.storage/registration-key'
    installPublicClient({ tokenUri: tokenUriUrl })
    installFetch({ tokenUriUrl, tokenUriPayload: canonicalRegistration })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const immutableCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'token-uri-immutable')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.tokenUriIsStrictImmutable).toBe(false)
    expect(res.body.data.tokenUriMatchesCanonical).toBe(true)
    expect(immutableCheck?.passed).toBe(false)
    expect(String(immutableCheck?.detail)).toContain('data:, ipfs://, or ar://')
  })

  it('surfaces a non-canonical onchain agentWallet separately from registration validity', async () => {
    installPublicClient({ agentWallet: NON_CANONICAL_WALLET })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const walletCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'canonical-agent-wallet')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.tokenUriMatchesCanonical).toBe(true)
    expect(res.body.data.walletBoundToCanonical).toBe(false)
    expect(walletCheck?.passed).toBe(false)
    expect(walletCheck?.detail).toContain('canonical CSW')
  })

  it('returns an actionable service probe failure when the advertised endpoint is unhealthy', async () => {
    installFetch({ endpointStatus: 503 })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const serviceCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'service-availability')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.endpoint.ok).toBe(false)
    expect(serviceCheck?.passed).toBe(false)
    expect(serviceCheck?.detail).toContain('503')
  })

  it('fails discoverability when the public registration mirror drifts from the canonical payload', async () => {
    installFetch({
      mirrorRegistration: {
        ...canonicalRegistration,
        description: 'Drifted mirror payload',
      },
    })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const mirrorCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'registration-mirror')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.mirrors.registration.matchesCanonical).toBe(false)
    expect(mirrorCheck?.passed).toBe(false)
    expect(String(mirrorCheck?.detail)).toContain('diverges')
  })

  it('fails discoverability when the domain proof advertises the wrong domain', async () => {
    installFetch({
      domainProof: {
        ...canonicalDomainProof,
        domain: 'app.4626.fun',
      },
    })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const domainCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'domain-proof')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.mirrors.domainVerification.matchesCanonical).toBe(false)
    expect(domainCheck?.passed).toBe(false)
    expect(String(domainCheck?.detail)).toContain('domain')
  })

  it('fails discoverability when the domain proof verifiedEndpoints drift from the canonical public surface', async () => {
    installFetch({
      domainProof: {
        ...canonicalDomainProof,
        verifiedEndpoints: [
          'https://4626.fun',
          'https://4626.fun/api/v1/spec.json',
        ],
      },
    })

    const { default: handler } = await import('../_handlers/v1/agents/identity/_verification.ts')
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/identity/verification' })
    const res = createMockRes()

    await handler(req, res)

    const domainCheck = res.body.data.checks.find((check: { id: string }) => check.id === 'domain-proof')

    expect(res.body.data.discoverabilityReady).toBe(false)
    expect(res.body.data.mirrors.domainVerification.matchesCanonical).toBe(false)
    expect(domainCheck?.passed).toBe(false)
    expect(String(domainCheck?.detail)).toContain('verifiedEndpoints')
  })
})
