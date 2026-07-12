import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  ensureSchema: vi.fn(async () => {}),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: vi.fn(async () => ({ sql: mocks.sql })),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureAlfaclubFundingOiObservationSchema: mocks.ensureSchema,
}))

import {
  recordFundingOiRegimeObservation,
  settleDueFundingOiRegimeHorizons,
} from './fundingOiObservationStore.js'

const OBSERVED_AT_MS = Date.parse('2026-07-12T12:00:00.000Z')

function normalizedSql(callIndex: number): string {
  return (mocks.sql.mock.calls[callIndex]?.[0] as TemplateStringsArray)
    .join('?')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('funding/OI shadow observation persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sql.mockResolvedValue({ rows: [] })
  })

  it('persists one idempotent observation and its fixed evaluation horizons', async () => {
    mocks.sql.mockResolvedValueOnce({ rows: [{ id: 'observation-1', inserted: true }] })

    const result = await recordFundingOiRegimeObservation({
      observedAtMs: OBSERVED_AT_MS,
      symbol: 'btc',
      markPriceUsd: 60_000,
      fundingRate: 0.00012,
      openInterestUsd: 900_000_000,
      volume24hUsd: 1_000_000_000,
      priceChange24hPct: 2.5,
      regime: 'crowded-longs',
      fundingBias: 'longs-paying',
      oiParticipation: 'high',
      confidence: 87,
      reasons: ['funding_positive_elevated', 'oi_participation_high'],
    })

    expect(result).toEqual({ observationId: 'observation-1', inserted: true })
    expect(mocks.ensureSchema).toHaveBeenCalledTimes(1)
    expect(mocks.sql).toHaveBeenCalledTimes(1)
    expect(normalizedSql(0)).toContain('INSERT INTO alfaclub.funding_oi_shadow_observation')
    expect(normalizedSql(0)).toContain('ON CONFLICT (source_provider, idempotency_key) DO UPDATE')
    expect(normalizedSql(0)).toContain('alfaclub.funding_oi_shadow_outcome')
    expect(mocks.sql.mock.calls[0]?.slice(1)).toEqual(expect.arrayContaining([
      'BTC',
      new Date(OBSERVED_AT_MS),
      'hyperliquid-meta-and-asset-ctxs',
      'funding-oi-regime-v1',
      'complete',
      [],
      60_000,
      'crowded-longs',
      'longs-paying',
      'high',
      87,
      ['funding_positive_elevated', 'oi_participation_high'],
    ]))
  })

  it('persists explicit provenance and missing-field quality for incomplete snapshots', async () => {
    mocks.sql.mockResolvedValueOnce({ rows: [{ id: 'observation-2', inserted: true }] })

    await recordFundingOiRegimeObservation({
      observedAtMs: OBSERVED_AT_MS,
      symbol: 'ETH',
      markPriceUsd: null,
      fundingRate: null,
      openInterestUsd: null,
      volume24hUsd: null,
      priceChange24hPct: null,
      regime: 'insufficient-data',
      fundingBias: 'unknown',
      oiParticipation: 'unknown',
      confidence: 0,
      reasons: ['Missing or invalid fields: fundingRate, openInterestUsd'],
      missingFields: ['markPriceUsd', 'fundingRate', 'openInterestUsd', 'volume24hUsd', 'priceChange24hPct'],
    })

    expect(normalizedSql(0)).toContain('source_provider')
    expect(normalizedSql(0)).toContain('classifier_version')
    expect(normalizedSql(0)).toContain('data_quality')
    expect(normalizedSql(0)).toContain('missing_fields')
    expect(mocks.sql.mock.calls[0]?.slice(1)).toEqual(expect.arrayContaining([
      'hyperliquid-meta-and-asset-ctxs',
      'funding-oi-regime-v1',
      'insufficient',
      ['markPriceUsd', 'fundingRate', 'openInterestUsd', 'volume24hUsd', 'priceChange24hPct'],
    ]))
  })

  it('reports the existing observation without duplicating its horizons', async () => {
    mocks.sql.mockResolvedValueOnce({ rows: [{ id: 'observation-1', inserted: false }] })

    const result = await recordFundingOiRegimeObservation({
      observedAtMs: OBSERVED_AT_MS,
      symbol: 'BTC',
      markPriceUsd: 60_000,
      fundingRate: null,
      openInterestUsd: null,
      volume24hUsd: null,
      priceChange24hPct: null,
      regime: 'insufficient-data',
      fundingBias: 'unknown',
      oiParticipation: 'unknown',
      confidence: 0,
      reasons: ['missing_funding'],
    })

    expect(result).toEqual({ observationId: 'observation-1', inserted: false })
    expect(normalizedSql(0)).toContain('ON CONFLICT (observation_id, horizon_hours) DO NOTHING')
    expect(normalizedSql(0)).toContain(
      'inserted_observation.observed_at + make_interval(hours => horizon_hours)',
    )
    expect(normalizedSql(0)).toContain('WHERE inserted_observation.mark_price_usd > 0')
  })

  it('deduplicates ACP retries by a stable source idempotency key', async () => {
    mocks.sql.mockResolvedValueOnce({ rows: [{ id: 'observation-1', inserted: false }] })

    await recordFundingOiRegimeObservation({
      idempotencyKey: 'virtuals:8453:job-123',
      observedAtMs: OBSERVED_AT_MS,
      symbol: 'BTC',
      markPriceUsd: 60_000,
      fundingRate: 0.00012,
      openInterestUsd: 900_000_000,
      volume24hUsd: 1_000_000_000,
      priceChange24hPct: 2.5,
      regime: 'crowded-longs',
      fundingBias: 'longs-paying',
      oiParticipation: 'high',
      confidence: 87,
      reasons: ['funding_positive_elevated'],
    })

    expect(normalizedSql(0)).toContain('idempotency_key')
    expect(normalizedSql(0)).toContain('ON CONFLICT (source_provider, idempotency_key) DO UPDATE')
    expect(mocks.sql.mock.calls[0]?.slice(1)).toContain('virtuals:8453:job-123')
  })
})

describe('funding/OI shadow horizon settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('settles all due horizons from their target timestamps with deterministic returns', async () => {
    mocks.sql
      .mockResolvedValueOnce({
        rows: [
          {
            observation_id: 'observation-1',
            symbol: 'BTC',
            horizon_hours: 1,
            due_at: '2026-07-12T13:00:00.000Z',
            observed_price_usd: '60000',
          },
          {
            observation_id: 'observation-2',
            symbol: 'BTC',
            horizon_hours: 4,
            due_at: '2026-07-12T12:30:00.000Z',
            observed_price_usd: '62500',
          },
        ],
      })
      .mockResolvedValue({ rows: [{ observation_id: 'settled' }], rowCount: 1 })
    const readMarkPriceAt = vi.fn(async (_symbol: string, targetAtMs: number) => ({
      priceUsd: 63_000,
      priceAtMs: targetAtMs,
    }))

    const result = await settleDueFundingOiRegimeHorizons({
      nowMs: Date.parse('2026-07-12T13:05:00.000Z'),
      readMarkPriceAt,
    })

    expect(result).toEqual({ due: 2, settled: 2, deferred: 0 })
    expect(readMarkPriceAt).toHaveBeenCalledTimes(2)
    expect(readMarkPriceAt).toHaveBeenNthCalledWith(
      1,
      'BTC',
      Date.parse('2026-07-12T13:00:00.000Z'),
    )
    expect(readMarkPriceAt).toHaveBeenNthCalledWith(
      2,
      'BTC',
      Date.parse('2026-07-12T12:30:00.000Z'),
    )
    expect(normalizedSql(0)).toContain('FROM alfaclub.funding_oi_shadow_outcome')
    expect(normalizedSql(0)).toContain('settled_at IS NULL')
    expect(normalizedSql(1)).toContain('UPDATE alfaclub.funding_oi_shadow_outcome')
    expect(mocks.sql.mock.calls[1]?.slice(1)).toEqual([
      new Date('2026-07-12T13:05:00.000Z'),
      new Date('2026-07-12T13:00:00.000Z'),
      63_000,
      5,
      'observation-1',
      1,
    ])
    expect(mocks.sql.mock.calls[2]?.slice(1)).toEqual([
      new Date('2026-07-12T13:05:00.000Z'),
      new Date('2026-07-12T12:30:00.000Z'),
      63_000,
      0.8,
      'observation-2',
      4,
    ])
  })

  it('leaves due horizons unsettled when the read has no valid price', async () => {
    mocks.sql.mockResolvedValueOnce({
      rows: [{
        observation_id: 'observation-1',
        symbol: 'ETH',
        horizon_hours: 24,
        due_at: '2026-07-12T12:00:00.000Z',
        observed_price_usd: '3000',
      }],
    })
    const readMarkPriceAt = vi.fn(async () => null)

    const result = await settleDueFundingOiRegimeHorizons({
      nowMs: Date.parse('2026-07-12T13:05:00.000Z'),
      readMarkPriceAt,
    })

    expect(result).toEqual({ due: 1, settled: 0, deferred: 1 })
    expect(mocks.sql).toHaveBeenCalledTimes(1)
  })

  it('counts a horizon as settled only when this worker wins the concurrent update', async () => {
    mocks.sql
      .mockResolvedValueOnce({
        rows: [{
          observation_id: 'observation-raced',
          symbol: 'BTC',
          horizon_hours: 4,
          due_at: '2026-07-12T12:00:00.000Z',
          observed_price_usd: '60000',
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const readMarkPriceAt = vi.fn(async (_symbol: string, targetAtMs: number) => ({
      priceUsd: 63_000,
      priceAtMs: targetAtMs,
    }))

    const result = await settleDueFundingOiRegimeHorizons({
      nowMs: Date.parse('2026-07-12T13:05:00.000Z'),
      readMarkPriceAt,
    })

    expect(result).toEqual({ due: 1, settled: 0, deferred: 0 })
  })

  it('isolates a rejected target-price read and continues settling later rows', async () => {
    mocks.sql
      .mockResolvedValueOnce({
        rows: [
          {
            observation_id: 'observation-failed',
            symbol: 'ETH',
            horizon_hours: 1,
            due_at: '2026-07-12T13:00:00.000Z',
            observed_price_usd: '3000',
          },
          {
            observation_id: 'observation-valid',
            symbol: 'BTC',
            horizon_hours: 1,
            due_at: '2026-07-12T13:00:00.000Z',
            observed_price_usd: '60000',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ observation_id: 'settled' }], rowCount: 1 })
    const readMarkPriceAt = vi.fn(async (symbol: string) => {
      if (symbol === 'ETH') throw new Error('provider unavailable')
      return { priceUsd: 63_000, priceAtMs: Date.parse('2026-07-12T13:00:00.000Z') }
    })

    const result = await settleDueFundingOiRegimeHorizons({
      nowMs: Date.parse('2026-07-12T13:05:00.000Z'),
      readMarkPriceAt,
    })

    expect(result).toEqual({ due: 2, settled: 1, deferred: 1 })
    expect(readMarkPriceAt).toHaveBeenNthCalledWith(1, 'ETH', Date.parse('2026-07-12T13:00:00.000Z'))
    expect(readMarkPriceAt).toHaveBeenNthCalledWith(2, 'BTC', Date.parse('2026-07-12T13:00:00.000Z'))
  })

  it('selects only settleable rows and stores the target price timestamp', async () => {
    mocks.sql
      .mockResolvedValueOnce({
        rows: [{
          observation_id: 'observation-1',
          symbol: 'BTC',
          horizon_hours: 4,
          due_at: '2026-07-12T16:00:00.000Z',
          observed_price_usd: '60000',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ observation_id: 'settled' }], rowCount: 1 })

    await settleDueFundingOiRegimeHorizons({
      nowMs: Date.parse('2026-07-12T18:00:00.000Z'),
      readMarkPriceAt: vi.fn(async () => ({
        priceUsd: 61_000,
        priceAtMs: Date.parse('2026-07-12T16:00:00.000Z'),
      })),
    })

    expect(normalizedSql(0)).toContain('observation.mark_price_usd > 0')
    expect(normalizedSql(1)).toContain('price_at =')
    expect(mocks.sql.mock.calls[1]?.slice(1)).toContainEqual(new Date('2026-07-12T16:00:00.000Z'))
  })
})
