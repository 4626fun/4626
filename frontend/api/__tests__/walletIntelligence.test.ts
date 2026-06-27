import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const traceFundersMock = vi.fn()
const getWalletLabelsBatchMock = vi.fn()
const getEnsProfileMock = vi.fn()
const getWalletPortfolioMock = vi.fn()
const resolveCanonicalMock = vi.fn()
const resolveLensMock = vi.fn()
const tryUploadMock = vi.fn()
const getCachedWalletIntelligenceMock = vi.fn()
const cacheWalletIntelligenceMock = vi.fn()
const guardMock = vi.fn()
const buildWalletIntelligenceMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getClientIpMock = vi.fn()
const rateLimitKeyMock = vi.fn()
const readBoundedJsonObjectBodyMock = vi.fn()

vi.mock('../../server/_lib/lens/funderTrace.js', () => ({
  traceFundersMultiChain: traceFundersMock,
}))

vi.mock('../../server/_lib/wallet/walletLabels.js', () => ({
  getWalletLabelsBatch: getWalletLabelsBatchMock,
}))

vi.mock('../../server/_lib/identity/ensResolver.js', () => ({
  getEnsProfile: getEnsProfileMock,
}))

vi.mock('../../server/_lib/lens/debankPortfolio.js', () => ({
  getWalletPortfolio: getWalletPortfolioMock,
}))

vi.mock('../../server/_lib/wallet/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: resolveCanonicalMock,
}))

vi.mock('../../server/_lib/identity/lensAccounts.js', () => ({
  resolveLensUserByOwner: resolveLensMock,
}))

vi.mock('../../server/_lib/lens/lensGrove.js', () => ({
  tryUploadImmutableJson: tryUploadMock,
}))

vi.mock('../../server/_lib/wallet/walletIntelligenceCache.js', () => ({
  getCachedWalletIntelligence: getCachedWalletIntelligenceMock,
  cacheWalletIntelligence: cacheWalletIntelligenceMock,
}))

vi.mock('@4626/server-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    handleOptions: vi.fn(() => false),
    setCors: vi.fn(),
    setNoStore: vi.fn(),
    guardAgentApiRequest: guardMock,
    getClientIp: getClientIpMock,
    RATE_LIMITS: {
      agentsRead: { limit: 120, windowMs: 60_000 },
    },
    checkRateLimit: checkRateLimitMock,
    checkDurableRateLimit: checkRateLimitMock,
    rateLimitKey: rateLimitKeyMock,
    readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
    buildWalletIntelligence: buildWalletIntelligenceMock,
    getCachedWalletIntelligence: getCachedWalletIntelligenceMock,
    cacheWalletIntelligence: cacheWalletIntelligenceMock,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    headers: {},
    query: { address: TEST_ADDRESS },
    ...overrides,
  }
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(data: unknown) {
      res.body = data
      return res
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value
      return res
    },
    end() {
      return res
    },
  }
  return res
}

function setupDefaults() {
  guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
  getClientIpMock.mockReturnValue('127.0.0.1')
  checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 })
  rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
  readBoundedJsonObjectBodyMock.mockImplementation(async (req: any) => req.body ?? null)
  resolveCanonicalMock.mockResolvedValue(null) // No CSW resolution
  getCachedWalletIntelligenceMock.mockResolvedValue(null)
  cacheWalletIntelligenceMock.mockResolvedValue(undefined)
  traceFundersMock.mockResolvedValue({
    target: TEST_ADDRESS,
    chain: [
      {
        address: TEST_ADDRESS,
        funderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        funderTxHash: '0xtx1',
        blockNumber: 100,
        timestamp: 1700000000,
        chainId: 8453,
        hop: 1,
      },
    ],
    complete: false,
    requestedHops: 3,
    stopReason: 'no_funder',
    chains: {},
  })
  getWalletLabelsBatchMock.mockResolvedValue({
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': {
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      labels: [{ name: 'Coinbase', category: 'exchange', source: 'walletlabels' }],
      isKnownEntity: true,
    },
  })
  getEnsProfileMock.mockResolvedValue({ name: 'test.eth', avatar: null })
  getWalletPortfolioMock.mockResolvedValue({
    address: TEST_ADDRESS,
    totalUsdValue: 42_000,
    topTokens: [{ id: 'eth', chain: 'eth', name: 'Ethereum', symbol: 'ETH', amount: 10, price: 4200, usdValue: 42_000 }],
    activeChains: [{ id: 'eth', name: 'Ethereum', usdValue: 42_000 }],
    protocols: [],
    asOf: Date.now(),
  })
  resolveLensMock.mockResolvedValue({
    handle: 'testuser',
    username: 'testuser',
    displayName: 'Test User',
    avatar: null,
    accountAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ownerAddress: TEST_ADDRESS,
  })
  tryUploadMock.mockResolvedValue({
    ok: true,
    result: {
      lensUri: 'lens://test-key',
      gatewayUrl: 'https://api.grove.storage/test-key',
      storageKey: 'test-key',
      statusUrl: null,
    },
  })

  buildWalletIntelligenceMock.mockImplementation(async (address: string) => {
    const [funderTrace, labels, ensProfile, portfolio, lensProfile] = await Promise.all([
      traceFundersMock(address),
      getWalletLabelsBatchMock(),
      getEnsProfileMock(address),
      getWalletPortfolioMock(address),
      resolveLensMock(address),
    ])

    const nodes: any[] = [{ id: `wallet:${address.toLowerCase()}`, type: 'wallet', label: address.toLowerCase(), data: { address: address.toLowerCase() } }]
    const edges: any[] = []

    for (const hop of funderTrace?.chain ?? []) {
      const funder = String(hop.funderAddress).toLowerCase()
      nodes.push({
        id: `funder:${funder}`,
        type: 'funder',
        label: funder,
        data: { address: funder, hop: hop.hop ?? 1 },
      })
      edges.push({ id: `edge:${funder}`, source: `funder:${funder}`, target: `wallet:${address.toLowerCase()}`, type: 'funded' })
    }

    for (const [entityAddress, label] of Object.entries(labels ?? {})) {
      const l = label as any
      nodes.push({
        id: `entity-label:${entityAddress.toLowerCase()}`,
        type: 'entity-label',
        label: l.labels?.[0]?.name ?? 'Unknown',
        data: {
          entityName: l.labels?.[0]?.name ?? 'Unknown',
          category: l.labels?.[0]?.category ?? 'unknown',
          address: entityAddress.toLowerCase(),
        },
      })
    }

    if (portfolio) {
      nodes.push({
        id: 'portfolio',
        type: 'portfolio',
        label: 'Portfolio',
        data: { totalUsdValue: portfolio.totalUsdValue ?? null },
      })
    }

    if (ensProfile?.name) {
      nodes.push({
        id: 'ens-name',
        type: 'ens-name',
        label: ensProfile.name,
        data: { name: ensProfile.name },
      })
    }

    if (lensProfile?.handle) {
      nodes.push({
        id: 'lens-account',
        type: 'lens-account',
        label: `@${lensProfile.handle}`,
        data: { handle: lensProfile.handle },
      })
    }

    return {
      target: address.toLowerCase(),
      canonicalWallet: null,
      nodes,
      edges,
      sources: {
        funderTrace,
        labels: labels ?? {},
        ens: ensProfile ?? null,
        portfolio: portfolio ?? null,
        lens: lensProfile ?? null,
      },
      source: 'wallet-intelligence.v1',
      generatedAt: new Date().toISOString(),
    }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wallet-intelligence API handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns discovery metadata for bare GET requests', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq({ query: {} })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.endpoint).toBe('/api/v1/agents/wallet-intelligence')
    expect(res.body.data.requiredQuery).toContain('address')
  })

  it('returns 400 when POST address is missing', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq({ method: 'POST', body: {}, query: {} })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/address/i)
  })

  it('returns 405 for unsupported methods', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq({ method: 'DELETE' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns enriched graph for valid address', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)

    const { graph, summary, groveStatus, provenance } = res.body.data
    expect(graph.target).toBe(TEST_ADDRESS)
    expect(graph.nodes.length).toBeGreaterThan(0)
    expect(graph.edges.length).toBeGreaterThan(0)
    expect(summary.funderChainLength).toBe(1)
    expect(summary.knownEntities).toBe(1)
    expect(summary.netWorth).toBe(42_000)
    expect(summary.ensName).toBe('test.eth')
    expect(summary.lensHandle).toBe('testuser')
    expect(groveStatus).toBe('stored')
    expect(provenance.cacheStatus).toBe('miss')
    expect(provenance.graphSource).toBe('wallet-intelligence.v1')
  })

  it('includes funder nodes in graph', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const { graph } = res.body.data
    const funderNodes = graph.nodes.filter((n: any) => n.type === 'funder')
    expect(funderNodes.length).toBe(1)
    expect(funderNodes[0].data.address).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(funderNodes[0].data.hop).toBe(1)
  })

  it('includes entity label nodes in graph', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const { graph } = res.body.data
    const labelNodes = graph.nodes.filter((n: any) => n.type === 'entity-label')
    expect(labelNodes.length).toBe(1)
    expect(labelNodes[0].data.entityName).toBe('Coinbase')
    expect(labelNodes[0].data.category).toBe('exchange')
  })

  it('includes portfolio node in graph', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const { graph } = res.body.data
    const portfolioNodes = graph.nodes.filter((n: any) => n.type === 'portfolio')
    expect(portfolioNodes.length).toBe(1)
    expect(portfolioNodes[0].data.totalUsdValue).toBe(42_000)
  })

  it('includes ENS node in graph', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const { graph } = res.body.data
    const ensNodes = graph.nodes.filter((n: any) => n.type === 'ens-name')
    expect(ensNodes.length).toBe(1)
    expect(ensNodes[0].label).toBe('test.eth')
  })

  it('includes Lens node in graph', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    const { graph } = res.body.data
    const lensNodes = graph.nodes.filter((n: any) => n.type === 'lens-account')
    expect(lensNodes.length).toBe(1)
    expect(lensNodes[0].label).toBe('@testuser')
  })

  it('skips Grove storage when store=false', async () => {
    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq({ query: { address: TEST_ADDRESS, store: 'false' } })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.groveStatus).toBe('skipped')
    expect(tryUploadMock).not.toHaveBeenCalled()
  })

  it('handles Grove unavailability gracefully', async () => {
    tryUploadMock.mockResolvedValue({ ok: false, error: 'Grove down' })

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.groveStatus).toBe('unavailable')
    expect(res.body.data.grove).toBeUndefined()
  })

  it('handles rate limiting', async () => {
    guardMock.mockResolvedValue({ ok: false, ip: '127.0.0.1' })

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    // guardAgentApiRequest handles the 429 response itself
    expect(res.statusCode).toBe(200) // handler returns early, guard already responded
  })

  it('handles missing portfolio gracefully', async () => {
    getWalletPortfolioMock.mockResolvedValue(null)

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const { graph } = res.body.data
    const portfolioNodes = graph.nodes.filter((n: any) => n.type === 'portfolio')
    expect(portfolioNodes.length).toBe(0)
  })

  it('handles missing ENS gracefully', async () => {
    getEnsProfileMock.mockResolvedValue({ name: null })

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const { graph } = res.body.data
    const ensNodes = graph.nodes.filter((n: any) => n.type === 'ens-name')
    expect(ensNodes.length).toBe(0)
  })

  it('handles missing Lens gracefully', async () => {
    resolveLensMock.mockResolvedValue(null)

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const { graph } = res.body.data
    const lensNodes = graph.nodes.filter((n: any) => n.type === 'lens-account')
    expect(lensNodes.length).toBe(0)
  })

  it('handles empty funder chain gracefully', async () => {
    traceFundersMock.mockResolvedValue({
      target: TEST_ADDRESS,
      chain: [],
      complete: false,
      requestedHops: 3,
      stopReason: 'no_funder',
      chains: {},
    })

    const { default: handler } = await import('../_handlers/v1/agents/_wallet-intelligence')
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const { graph, summary } = res.body.data
    const funderNodes = graph.nodes.filter((n: any) => n.type === 'funder')
    expect(funderNodes.length).toBe(0)
    expect(summary.funderChainLength).toBe(0)
  })
})

describe('funderTrace module', () => {
  it('traceFundersMultiChain mock is callable', () => {
    expect(typeof traceFundersMock).toBe('function')
    traceFundersMock.mockResolvedValueOnce({ target: '0x', chain: [], complete: false, requestedHops: 1, chains: {} })
    expect(traceFundersMock).toBeDefined()
  })
})

describe('walletLabels module', () => {
  it('getWalletLabelsBatch mock is callable', () => {
    expect(typeof getWalletLabelsBatchMock).toBe('function')
    getWalletLabelsBatchMock.mockResolvedValueOnce({})
    expect(getWalletLabelsBatchMock).toBeDefined()
  })
})

describe('ensResolver module', () => {
  it('getEnsProfile mock is callable', () => {
    expect(typeof getEnsProfileMock).toBe('function')
    getEnsProfileMock.mockResolvedValueOnce({ name: null })
    expect(getEnsProfileMock).toBeDefined()
  })
})

describe('debankPortfolio module', () => {
  it('getWalletPortfolio mock is callable', () => {
    expect(typeof getWalletPortfolioMock).toBe('function')
    getWalletPortfolioMock.mockResolvedValueOnce(null)
    expect(getWalletPortfolioMock).toBeDefined()
  })
})
