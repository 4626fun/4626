import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { exportSettledDecisionsJsonlMock, checkDurableRateLimitMock } = vi.hoisted(() => ({
  exportSettledDecisionsJsonlMock: vi.fn(),
  checkDurableRateLimitMock: vi.fn(async () => ({ allowed: true, resetAt: Date.now() + 60_000 })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('@4626/server-core')
  return {
    ...actual,
    checkDurableRateLimit: checkDurableRateLimitMock,
  }
})

vi.mock('../../server/_lib/alfaclub/decisions/publicLedgerExport.js', () => ({
  exportSettledDecisionsJsonl: exportSettledDecisionsJsonlMock,
}))

import exportHandler from '../_handlers/v1/alfaclub/_decision-ledger-export.ts'

describe('GET /api/v1/alfaclub/decision-ledger-export', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    exportSettledDecisionsJsonlMock.mockResolvedValue({
      jsonl: '{"decision_id":"x"}',
      rowCount: 1,
      report: { claimAllowed: false, sampleSize: 1 },
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects unsupported methods with 405', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await exportHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(exportSettledDecisionsJsonlMock).not.toHaveBeenCalled()
  })

  it('returns 503 when CRON_SECRET is not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({ CRON_SECRET: undefined })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await exportHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ success: false, error: 'CRON_SECRET is not configured' })
  })

  it('rejects unauthorized callers', async () => {
    const req = createMockReq({ method: 'GET', headers: {} })
    const res = createMockRes()
    await exportHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' })
    expect(exportSettledDecisionsJsonlMock).not.toHaveBeenCalled()
  })

  it('returns privacy-safe export for cron-authenticated GET', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
      query: { minSampleForClaims: '50' },
    })
    const res = createMockRes()
    await exportHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(exportSettledDecisionsJsonlMock).toHaveBeenCalledWith({ minSampleForClaims: 50 })
    expect(res.body).toEqual({
      success: true,
      reason: null,
      data: {
        rowCount: 1,
        report: { claimAllowed: false, sampleSize: 1 },
        jsonl: '{"decision_id":"x"}',
      },
    })
  })
})
