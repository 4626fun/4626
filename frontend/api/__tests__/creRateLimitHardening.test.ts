import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  checkRateLimit: vi.fn(() => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '203.0.113.15'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  authenticateRuntimeRequest: vi.fn(async () => ({ ok: true, correlationId: 'corr-cre-rate-limit' })),
  executeCreHttpTrigger: vi.fn(),
  listRuntimeRecords: vi.fn(async () => []),
  storeRuntimeRecord: vi.fn(),
  storeRuntimeDecision: vi.fn(),
  maybeEnqueueRuntimeAction: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readJsonBody: mocks.readJsonBody,
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  logger: mocks.logger,
  RATE_LIMITS: {
    creRuntimeTriggerWrite: { windowMs: 60_000, maxRequests: 60 },
    creRuntimeDecisionsWrite: { windowMs: 60_000, maxRequests: 60 },
    creRuntimeIngestRead: { windowMs: 60_000, maxRequests: 120 },
    creRuntimeIngestWrite: { windowMs: 60_000, maxRequests: 60 },
  },
}))

vi.mock('../../server/_lib/cre/runtimeBridge.js', () => ({
  authenticateRuntimeRequest: mocks.authenticateRuntimeRequest,
  executeCreHttpTrigger: mocks.executeCreHttpTrigger,
  listRuntimeRecords: mocks.listRuntimeRecords,
  storeRuntimeRecord: mocks.storeRuntimeRecord,
  storeRuntimeDecision: mocks.storeRuntimeDecision,
  maybeEnqueueRuntimeAction: mocks.maybeEnqueueRuntimeAction,
}))

import decisionsHandler from '../_handlers/cre/runtime/_decisions.ts'
import ingestHandler from '../_handlers/cre/runtime/_ingest.ts'
import triggerHandler from '../_handlers/cre/runtime/_trigger.ts'

describe('CRE runtime rate-limit hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 + Retry-After for /cre/runtime/trigger', async () => {
    const req = createMockReq({ method: 'POST', body: { workflowId: 'a'.repeat(64), input: { ping: true } } })
    const res = createMockRes()

    await triggerHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /cre/runtime/decisions', async () => {
    const req = createMockReq({ method: 'POST', body: { workflow: 'runtime-orchestrator', idempotencyKey: 'k', decision: {} } })
    const res = createMockRes()

    await decisionsHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /cre/runtime/ingest', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await ingestHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
