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
    keeperTriggerWrite: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import syncCreatorMetricsHandler from '../_handlers/zora/_sync-creator-metrics.ts'
import creatorAccessRequestHandler from '../_handlers/creator-access/_request.ts'
import keeperAiAssessHandler from '../_handlers/keeper/_aiAssess.ts'
import keeperAlertHandler from '../_handlers/keeper/_alert.ts'
import keeperMarkSettledHandler from '../_handlers/keeper/_markSettled.ts'
import keeperReportHandler from '../_handlers/keeper/_report.ts'
import keeperSolanaReconcileHandler from '../_handlers/keeper/_solanaReconcile.ts'
import keeperSweepHandler from '../_handlers/keeper/_sweep.ts'
import keeperTendHandler from '../_handlers/keeper/_tend.ts'

describe('ops endpoint rate-limit hardening', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KPR_API_KEY: 'test-keepr-key',
      CRON_SECRET: 'test-cron-secret',
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
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

  it('returns 429 for /keeper/aiAssess when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperAiAssessHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/alert when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperAlertHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/mark-settled when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperMarkSettledHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/report when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperReportHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/solana/reconcile when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperSolanaReconcileHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/sweep when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperSweepHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 for /keeper/tend when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {},
    })
    const res = createMockRes()
    await keeperTendHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
