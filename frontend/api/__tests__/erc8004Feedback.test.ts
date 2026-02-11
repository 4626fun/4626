import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { guardMock, tryUploadMock, buildReputationGraphMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  tryUploadMock: vi.fn(),
  buildReputationGraphMock: vi.fn(),
}))

// Mock the rate-limit guard so tests don't need a real DB / IP lookup.
vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  AGENT_RATE_LIMITS: {
    read: { windowMs: 60_000, maxRequests: 120 },
    logs: { windowMs: 60_000, maxRequests: 30 },
    build: { windowMs: 60_000, maxRequests: 60 },
    write: { windowMs: 60_000, maxRequests: 30 },
  },
  guardAgentApiRequest: guardMock,
}))

vi.mock('../../server/_lib/lensGrove.js', () => ({
  LENS_MAINNET_CHAIN_ID: 232,
  uploadImmutableJson: tryUploadMock,
  tryUploadImmutableJson: tryUploadMock,
  resolveLensUri: (uri: string) => uri,
}))

vi.mock('../../server/_lib/reputationGraph.js', () => ({
  buildReputationGraph: buildReputationGraphMock,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CLIENT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'

function groveResult(overrides: Record<string, unknown> = {}) {
  return {
    storageKey: 'test-storage-key',
    gatewayUrl: 'https://api.grove.storage/test-key',
    lensUri: 'lens://test-key',
    statusUrl: null,
    ...overrides,
  }
}

/** Mock a successful tryUploadImmutableJson response. */
function groveOk(overrides: Record<string, unknown> = {}) {
  return { ok: true, result: groveResult(overrides) }
}

/** Mock a failed tryUploadImmutableJson response. */
function groveFail(error = 'Grove upload failed (530): Origin DNS error') {
  return { ok: false, error }
}

// ---------------------------------------------------------------------------
// _submit.ts — calldata builder (fully offline, no RPC)
// ---------------------------------------------------------------------------

describe('v1/agents/feedback/submit', () => {
  let handler: (req: any, res: any) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    const mod = await import('../_handlers/v1/agents/feedback/_submit.ts')
    handler = mod.default
  })

  it('returns 405 for GET', async () => {
    const req = createMockReq({ method: 'GET', url: '/api/v1/agents/feedback/submit' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('returns 400 for missing action', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('action must be')
  })

  it('builds giveFeedback calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'give', agentId: 1, value: 5, valueDecimals: 0, tag1: 'fast', tag2: 'accurate' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.action).toBe('giveFeedback')
    expect(res.body.data.calldata).toMatch(/^0x/)
    expect(res.body.data.to).toMatch(/^0x/)
    expect(res.body.data.args.agentId).toBe(1)
    expect(res.body.data.args.value).toBe(5)
    expect(res.body.data.args.tag1).toBe('fast')
    expect(res.body.data.args.tag2).toBe('accurate')
  })

  it('auto-hashes feedbackURI when no explicit hash provided', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'give', agentId: 1, value: 4, valueDecimals: 0, feedbackURI: 'lens://abc123' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.args.feedbackHash).toMatch(/^0x[a-f0-9]{64}$/)
    // Hash should NOT be the zero bytes32
    expect(res.body.data.args.feedbackHash).not.toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    )
  })

  it('builds revokeFeedback calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'revoke', agentId: 1, feedbackIndex: 1 },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.action).toBe('revokeFeedback')
    expect(res.body.data.args.feedbackIndex).toBe(1)
  })

  it('rejects revoke with feedbackIndex=0', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'revoke', agentId: 1, feedbackIndex: 0 },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('feedbackIndex must be > 0')
  })

  it('builds appendResponse calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        action: 'respond',
        agentId: 1,
        clientAddress: '0x742d35cc6634c0532925a3b844bc9e7595f2bd18',
        feedbackIndex: 1,
        responseURI: 'lens://response-abc',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.action).toBe('appendResponse')
    expect(res.body.data.args.clientAddress).toBe('0x742d35cc6634c0532925a3b844bc9e7595f2bd18')
    expect(res.body.data.args.responseHash).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('rejects respond with invalid clientAddress', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'respond', agentId: 1, clientAddress: 'not-an-address', feedbackIndex: 1, responseURI: 'x' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('clientAddress')
  })

  it('rejects valueDecimals > 18', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { action: 'give', agentId: 1, value: 5, valueDecimals: 20 },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('valueDecimals')
  })
})

// ---------------------------------------------------------------------------
// _read.ts — on-chain reader (mock viem client)
// ---------------------------------------------------------------------------

describe('v1/agents/feedback (read)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
  })

  it('returns 405 for POST', async () => {
    const mod = await import('../_handlers/v1/agents/feedback/_read.ts')
    const req = createMockReq({ method: 'POST', url: '/api/v1/agents/feedback' })
    const res = createMockRes()
    await mod.default(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for missing agentId', async () => {
    const mod = await import('../_handlers/v1/agents/feedback/_read.ts')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await mod.default(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('agentId')
  })

  it('returns 400 for non-numeric agentId', async () => {
    const mod = await import('../_handlers/v1/agents/feedback/_read.ts')
    const req = createMockReq({ method: 'GET', query: { agentId: 'abc' } })
    const res = createMockRes()
    await mod.default(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('agentId')
  })
})

// ---------------------------------------------------------------------------
// _feedback-payload.ts — Grove payload storage
// ---------------------------------------------------------------------------

describe('lens/feedback-payload', () => {
  let handler: (req: any, res: any) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()
    tryUploadMock.mockResolvedValue(groveOk())
    const mod = await import('../_handlers/lens/_feedback-payload.ts')
    handler = mod.default
  })

  it('returns 405 for GET', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for missing agentId', async () => {
    const req = createMockReq({ method: 'POST', body: { value: '5' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('agentId')
  })

  it('returns 400 for invalid valueDecimals', async () => {
    const req = createMockReq({ method: 'POST', body: { agentId: 1, value: '5', valueDecimals: 20 } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('valueDecimals')
  })

  it('stores payload on Grove and returns feedbackURI + hash', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        agentId: 1,
        value: '5',
        valueDecimals: 0,
        reasoning: 'Excellent agent',
        tag1: 'fast',
        tag2: 'accurate',
        clientAddress: TEST_CLIENT_ADDRESS,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.feedbackURI).toBe('lens://test-key')
    expect(res.body.data.feedbackHash).toMatch(/^0x[a-f0-9]{64}$/)
    expect(res.body.data.gatewayUrl).toBe('https://api.grove.storage/test-key')
    expect(res.body.data.groveStatus).toBe('stored')
    expect(res.body.data.payload.agentId).toBe(1)
    expect(res.body.data.payload.reasoning).toBe('Excellent agent')
    expect(tryUploadMock).toHaveBeenCalledOnce()
  })

  it('returns hash without storing when store=false', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { agentId: 1, value: '4', valueDecimals: 0, store: false },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.feedbackURI).toBeNull()
    expect(res.body.data.feedbackHash).toMatch(/^0x[a-f0-9]{64}$/)
    expect(res.body.data.gatewayUrl).toBeNull()
    expect(tryUploadMock).not.toHaveBeenCalled()
  })

  it('degrades gracefully when Grove is unavailable', async () => {
    tryUploadMock.mockResolvedValue(groveFail())
    const req = createMockReq({
      method: 'POST',
      body: { agentId: 1, value: '5', valueDecimals: 0, reasoning: 'Test' },
    })
    const res = createMockRes()
    await handler(req, res)

    // Should still return 200 with the hash — not 500
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.feedbackHash).toMatch(/^0x[a-f0-9]{64}$/)
    expect(res.body.data.feedbackURI).toBeNull()
    expect(res.body.data.groveStatus).toBe('unavailable')
    expect(res.body.data.groveError).toContain('Grove upload failed')
    expect(res.body.data.payload.agentId).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// _reputation-graph.ts — graph builder + Grove
// ---------------------------------------------------------------------------

describe('lens/reputation-graph', () => {
  let handler: (req: any, res: any) => Promise<unknown>

  const mockGraph = {
    version: '1.0',
    agentId: 1,
    nodes: [{ id: 'agent:1', type: 'agent', label: 'Agent #1' }],
    edges: [],
    groups: [],
    summary: { totalFeedback: 0, totalReviewers: 0, averageRating: '0', label: 'No feedback' },
    metadata: { generatedAt: '2026-01-01T00:00:00Z', source: 'erc8004.reputation.graph' },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    buildReputationGraphMock.mockResolvedValue(mockGraph)
    tryUploadMock.mockResolvedValue(groveOk())
    const mod = await import('../_handlers/lens/_reputation-graph.ts')
    handler = mod.default
  })

  it('returns 405 for PUT', async () => {
    const req = createMockReq({ method: 'PUT' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for missing agentId', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('agentId')
  })

  it('builds graph and stores on Grove by default', async () => {
    const req = createMockReq({ method: 'POST', body: { agentId: 1 } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.graph).toEqual(mockGraph)
    expect(res.body.data.grove).toBeDefined()
    expect(res.body.data.grove.lensUri).toBe('lens://test-key')
    expect(res.body.data.groveStatus).toBe('stored')
    expect(buildReputationGraphMock).toHaveBeenCalledWith({
      agentId: 1,
      tag1Filter: '',
      tag2Filter: '',
      includeRevoked: true,
    })
    expect(tryUploadMock).toHaveBeenCalledOnce()
  })

  it('returns graph without Grove when store=false', async () => {
    const req = createMockReq({ method: 'POST', body: { agentId: 1, store: false } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.graph).toEqual(mockGraph)
    expect(res.body.data.grove).toBeUndefined()
    expect(res.body.data.groveStatus).toBe('skipped')
    expect(tryUploadMock).not.toHaveBeenCalled()
  })

  it('supports GET with query params', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { agentId: '1', tag1: 'fast', includeRevoked: 'false', store: 'false' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.groveStatus).toBe('skipped')
    expect(buildReputationGraphMock).toHaveBeenCalledWith({
      agentId: 1,
      tag1Filter: 'fast',
      tag2Filter: '',
      includeRevoked: false,
    })
  })

  it('returns 500 when graph builder throws', async () => {
    buildReputationGraphMock.mockRejectedValue(new Error('RPC timeout'))
    const req = createMockReq({ method: 'POST', body: { agentId: 1 } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('RPC timeout')
  })

  it('degrades gracefully when Grove is unavailable', async () => {
    tryUploadMock.mockResolvedValue(groveFail())
    const req = createMockReq({ method: 'POST', body: { agentId: 1 } })
    const res = createMockRes()
    await handler(req, res)

    // Should still return 200 with the graph — not 500
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.graph).toEqual(mockGraph)
    expect(res.body.data.grove).toBeUndefined()
    expect(res.body.data.groveStatus).toBe('unavailable')
    expect(res.body.data.groveError).toContain('Grove upload failed')
  })
})
