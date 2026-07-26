import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: vi.fn(),
  getDbForCron: vi.fn(),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureMigrationApplied: vi.fn(),
  ensureCreatorMetricsBaseSchema: vi.fn(),
  ensureFinalAdditiveColumns: vi.fn(),
}))

vi.mock('../infra/logger.js', () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) },
}))

vi.mock('../../zora/_shared.js', () => ({
  requireServerKey: vi.fn(() => null),
}))

vi.mock('./exploreSparklinePrecompute.js', () => ({
  precomputeExploreSparklinesForCoins: vi.fn(),
}))

describe('creator metrics hero totals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlMock.mockResolvedValue({ rows: [{ coin_address: '0xabc' }, { coin_address: '0xdef' }] })
  })

  it('recompute applies hero mcap liquidity gate in the SUM', async () => {
    const { recomputeAndCacheCreatorMetricsTotals } = await import('./creatorMetricsSync.js')
    await recomputeAndCacheCreatorMetricsTotals({ sql: sqlMock })

    expect(sqlMock).toHaveBeenCalledTimes(1)
    const strings = sqlMock.mock.calls[0][0] as TemplateStringsArray
    const values = sqlMock.mock.calls[0].slice(1) as unknown[]
    const sqlText = strings.join('?')
    expect(sqlText).toContain('CASE')
    expect(sqlText).toContain('unique_holders')
    expect(sqlText).toContain('volume_24h_usd')
    expect(sqlText).toContain('market_cap_usd')
    // Default gate values interpolated into the query
    expect(values).toEqual(expect.arrayContaining([50, 1_000, 10_000_000, 8453]))
  })

  it('expireStaleCreatorCoinVolumeFees zeros volume/fees for stale last_seen rows', async () => {
    const { expireStaleCreatorCoinVolumeFees } = await import('./creatorMetricsSync.js')
    const zeroed = await expireStaleCreatorCoinVolumeFees(
      { sql: sqlMock },
      { maxAgeMs: 48 * 60 * 60 * 1000, batchSize: 500 },
    )

    expect(zeroed).toBe(2)
    expect(sqlMock).toHaveBeenCalledTimes(1)
    const strings = sqlMock.mock.calls[0][0] as TemplateStringsArray
    const values = sqlMock.mock.calls[0].slice(1) as unknown[]
    const sqlText = strings.join('?')
    expect(sqlText).toContain('volume_24h_usd = 0')
    expect(sqlText).toContain('fees_24h_usd = 0')
    expect(sqlText).toContain('fees_24h_creator_usd = 0')
    expect(sqlText).toContain('fees_24h_indexed_at = NULL')
    expect(sqlText).toContain('make_interval')
    expect(sqlText).not.toContain('market_cap_usd = 0')
    expect(values).toEqual(expect.arrayContaining([8453, 48 * 60 * 60, 500]))
  })
})
