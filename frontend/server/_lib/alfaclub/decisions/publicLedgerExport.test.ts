import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  ensureAlfaclubDecisionLedgerSchema: vi.fn(async () => undefined),
}))

vi.mock('../../db/postgres.js', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../db/schemaBootstrap.js', () => ({
  ensureAlfaclubDecisionLedgerSchema: mocks.ensureAlfaclubDecisionLedgerSchema,
}))

import { exportSettledDecisionsJsonl } from './publicLedgerExport.js'

describe('exportSettledDecisionsJsonl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty report when db is unavailable', async () => {
    mocks.getDb.mockResolvedValueOnce(null)
    const result = await exportSettledDecisionsJsonl({ minSampleForClaims: 10 })
    expect(result.rowCount).toBe(0)
    expect(result.jsonl).toBe('')
    expect(result.report.claimAllowed).toBe(false)
    expect(result.report.sampleSize).toBe(0)
    expect(mocks.ensureAlfaclubDecisionLedgerSchema).not.toHaveBeenCalled()
  })

  it('hashes source ids and keeps claimAllowed false below min sample', async () => {
    const sourceId = 'alfaclub_room_1659'
    const expectedHash = createHash('sha256').update(sourceId).digest('hex').slice(0, 16)
    mocks.getDb.mockResolvedValueOnce({
      sql: vi.fn(async () => ({
        rows: [
          {
            decision_id: '11111111-1111-1111-1111-111111111111',
            observed_at: '2026-07-12T08:00:00.000Z',
            asset: 'HYPE',
            source_id: sourceId,
            decision: 'COUNTER',
            confidence: 0.72,
            regime_fine: 'crowded_long_exhaustion',
            methodology_version: 'inv-akita-decision-v1.0.0',
            horizon_hours: 8,
            net_bps: 25,
            would_have_been_always_inverse_bps: 10,
          },
          {
            decision_id: '22222222-2222-2222-2222-222222222222',
            observed_at: '2026-07-12T09:00:00.000Z',
            asset: 'BTC',
            source_id: null,
            decision: 'SKIP',
            confidence: 0.4,
            regime_fine: 'insufficient_data',
            methodology_version: 'inv-akita-decision-v1.0.0',
            horizon_hours: 8,
            net_bps: 0,
            would_have_been_always_inverse_bps: -5,
          },
        ],
      })),
    })

    const result = await exportSettledDecisionsJsonl({ minSampleForClaims: 100 })
    expect(mocks.ensureAlfaclubDecisionLedgerSchema).toHaveBeenCalledTimes(1)
    expect(result.rowCount).toBe(2)
    expect(result.report.claimAllowed).toBe(false)
    expect(result.report.sampleSize).toBe(2)

    const lines = result.jsonl.split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines[0]).toEqual(
      expect.objectContaining({
        asset: 'HYPE',
        source_id_hash: expectedHash,
        decision: 'COUNTER',
        conditional_inverse_edge_bps: 15,
      }),
    )
    expect(lines[0]).not.toHaveProperty('source_id')
    expect(lines[1]).toEqual(
      expect.objectContaining({
        asset: 'BTC',
        source_id_hash: null,
        conditional_inverse_edge_bps: 5,
      }),
    )
  })
})
