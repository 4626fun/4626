import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureCreatorMetricsSchemaMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureCreatorMetricsSchemaMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/creatorMetricsSync.js', () => ({
  ensureCreatorMetricsSchema: ensureCreatorMetricsSchemaMock,
}))

vi.mock('../../server/zora/_shared.js', () => ({
  getStringQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptions: vi.fn(() => false),
  setCache: vi.fn(),
  setCors: vi.fn(),
}))

describe('GET /api/zora/metrics', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const sql = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          backfill_complete: false,
          sync_status: 'running',
          sync_error: null,
          sampled_creators: 24,
          last_sync_started_at: '2026-03-08T00:00:00.000Z',
          last_sync_finished_at: null,
          last_full_sync_at: null,
          drift_estimate_total: 12,
          drift_pct: 4.5,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          creators_total: '128',
          creators_new_24h: '7',
          market_cap_usd: '1250000.25',
          volume_24h_usd: '83000.55',
          fees_24h_usd: '1250.10',
        }],
      })

    getDbMock.mockResolvedValue({ sql })
    ensureCreatorMetricsSchemaMock.mockResolvedValue(undefined)
  })

  it('returns usable aggregate totals even while canonical sync is partial', async () => {
    const { default: handler } = await import('../_handlers/zora/_metrics.ts')
    const req = createMockReq({
      method: 'GET',
      query: { scope: 'creators' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.exact).toBe(false)
    expect(res.body?.data?.totals).toMatchObject({
      creatorsTotal: 128,
      creatorsNew24h: 7,
      creatorCoinsMarketCapUsd: 1250000.25,
      creatorCoinsVolume24hUsd: 83000.55,
      creatorCoinsFees24hUsd: 1250.1,
      partial: true,
      sampledCreators: 24,
    })
  })

  it('serves stale cache and swallows background refresh failures', async () => {
    const { default: handler } = await import('../_handlers/zora/_metrics.ts')
    const req = createMockReq({
      method: 'GET',
      query: { scope: 'creators' },
    })

    const nowSpy = vi.spyOn(Date, 'now')
    const baseNow = 1_710_000_000_000
    nowSpy.mockReturnValue(baseNow)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const firstRes = createMockRes()
      await handler(req, firstRes)
      expect(firstRes.statusCode).toBe(200)
      const stalePayload = firstRes.body?.data

      const timeoutErr = new Error('timeout exceeded when trying to connect')
      const failingSql = vi.fn().mockRejectedValue(timeoutErr)
      getDbMock.mockResolvedValueOnce({ sql: failingSql })

      // Advance beyond cache TTL so handler serves stale cache while refreshing.
      nowSpy.mockReturnValue(baseNow + 5 * 60 * 1000 + 1)

      const secondRes = createMockRes()
      await handler(req, secondRes)
      expect(secondRes.statusCode).toBe(200)
      expect(secondRes.body?.data).toEqual(stalePayload)

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[zora/metrics] background refresh failed'),
        timeoutErr,
      )
    } finally {
      nowSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it('backs off stale refresh retries after repeated DB timeout failures', async () => {
    const { default: handler } = await import('../_handlers/zora/_metrics.ts')
    const req = createMockReq({
      method: 'GET',
      query: { scope: 'creators' },
    })

    const nowSpy = vi.spyOn(Date, 'now')
    const baseNow = 1_710_000_000_000
    nowSpy.mockReturnValue(baseNow)

    const initialSql = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          backfill_complete: false,
          sync_status: 'running',
          sync_error: null,
          sampled_creators: 24,
          last_sync_started_at: '2026-03-08T00:00:00.000Z',
          last_sync_finished_at: null,
          last_full_sync_at: null,
          drift_estimate_total: 12,
          drift_pct: 4.5,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          creators_total: '128',
          creators_new_24h: '7',
          market_cap_usd: '1250000.25',
          volume_24h_usd: '83000.55',
          fees_24h_usd: '1250.10',
        }],
      })

    const timeoutErr = new Error('timeout exceeded when trying to connect')
    const failingSql = vi.fn().mockRejectedValue(timeoutErr)

    getDbMock.mockReset()
    getDbMock.mockResolvedValueOnce({ sql: initialSql }).mockResolvedValue({ sql: failingSql })

    const primeRes = createMockRes()
    await handler(req, primeRes)
    expect(primeRes.statusCode).toBe(200)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      // Trigger first stale refresh attempt (will fail in background).
      nowSpy.mockReturnValue(baseNow + 5 * 60 * 1000 + 1)
      const staleRes1 = createMockRes()
      await handler(req, staleRes1)
      expect(staleRes1.statusCode).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(failingSql).toHaveBeenCalledTimes(2)

      // Within backoff window, stale responses should not trigger another DB retry.
      nowSpy.mockReturnValue(baseNow + 5 * 60 * 1000 + 10_000)
      const staleRes2 = createMockRes()
      await handler(req, staleRes2)
      expect(staleRes2.statusCode).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(failingSql).toHaveBeenCalledTimes(2)
      expect(errorSpy).toHaveBeenCalledTimes(1)
    } finally {
      nowSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
