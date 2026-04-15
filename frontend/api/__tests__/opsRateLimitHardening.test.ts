import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes, withAuthHeader } from './helpers'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '198.51.100.55'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    adminAction: { windowMs: 60_000, maxRequests: 1 },
    creatorQuickstart: { windowMs: 60_000, maxRequests: 1 },
    creRuntimeTriggerWrite: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import syncCreatorMetricsHandler from '../_handlers/_sync-creator-metrics.ts'
import creatorAccessRequestHandler from '../_handlers/creator-access/_request.ts'
import creKeeperAiAssessHandler from '../_handlers/cre/keeper/_aiAssess.ts'
import creKeeperAlertHandler from '../_handlers/cre/keeper/_alert.ts'
import creKeeperMarkSettledHandler from '../_handlers/cre/keeper/_markSettled.ts'
import creKeeperReportHandler from '../_handlers/cre/keeper/_report.ts'
import creKeeperSolanaReconcileHandler from '../_handlers/cre/keeper/_solanaReconcile.ts'
import creKeeperSweepHandler from '../_handlers/cre/keeper/_sweep.ts'
import creKeeperTendHandler from '../_handlers/cre/keeper/_tend.ts'

describe('ops endpoint rate-limit hardening', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-keepr-key',
      CRON_SECRET: 'test-cron-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 429 for /sync-creator-metrics when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await syncCreatorMetricsHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /creator-access/request when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader(),
      body: { coin: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()
    await creatorAccessRequestHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/aiAssess when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperAiAssessHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/alert when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperAlertHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/mark-settled when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperMarkSettledHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/report when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperReportHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/solana/reconcile when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperSolanaReconcileHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/sweep when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperSweepHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /cre/keeper/tend when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await creKeeperTendHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
