import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_metrics.ts'
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
  beforeEach(() => {
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
})
