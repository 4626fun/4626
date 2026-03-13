import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_trendSentinelProcess.ts'
import { createMockReq, createMockRes } from './helpers'

const { runTrendLaunchSentinelProcessMock } = vi.hoisted(() => ({
  runTrendLaunchSentinelProcessMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
}))

vi.mock('../../server/zora/trendLaunchSentinel.js', () => ({
  runTrendLaunchSentinelProcess: runTrendLaunchSentinelProcessMock,
}))

describe('POST /api/zora/trendSentinelProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TREND_SENTINEL_SECRET = 'test-secret'
  })

  it('rejects unauthorized requests', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })

  it('runs sentinel when authorized', async () => {
    runTrendLaunchSentinelProcessMock.mockResolvedValueOnce({
      status: 'secured',
      securedTicker: 'AI',
      txHash: '0xtx',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: { maxRuntimeMs: 10_000, tickers: ['AI', '67'] },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('secured')
    expect(runTrendLaunchSentinelProcessMock).toHaveBeenCalledTimes(1)
  })
})

