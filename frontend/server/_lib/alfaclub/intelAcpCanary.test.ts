import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPerpMarketContext: vi.fn(),
  classifyFineFundingOiRegime: vi.fn(),
  decideCounterDelaySkip: vi.fn(),
  recordDecisionLedgerEntry: vi.fn(),
}))

vi.mock('./hyperliquid.js', () => ({
  getPerpMarketContext: mocks.getPerpMarketContext,
  getAllPerpMarketContexts: vi.fn(),
  getUserFillsByTimeDetailed: vi.fn(),
}))

vi.mock('./regimes/fundingOiRegimeFine.js', () => ({
  classifyFineFundingOiRegime: mocks.classifyFineFundingOiRegime,
  FINE_REGIME_METHODOLOGY_VERSION: 'inv-akita-regime-v1.0.0',
}))

vi.mock('./decisions/counterDecisionEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./decisions/counterDecisionEngine.js')>()
  return {
    ...actual,
    decideCounterDelaySkip: mocks.decideCounterDelaySkip,
  }
})

vi.mock('./decisions/decisionLedgerStore.js', () => ({
  recordDecisionLedgerEntry: mocks.recordDecisionLedgerEntry,
}))

import {
  runCounterTradeAnalysisJob,
  runFundingOiRegimeIntelJob,
} from '../../../server/agents/eliza/plugins/virtuals/intelJobs.js'

describe('InverseAKITA ACP canary job paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.INV_AKITA_INTEL_KILL
    mocks.getPerpMarketContext.mockResolvedValue({
      symbol: 'HYPE',
      markPriceUsd: 38.5,
      fundingRate: 0.00021,
      openInterestUsd: 42_000_000,
      volume24hUsd: 180_000_000,
      priceChange24hPct: 4.7,
      oraclePriceUsd: 38.4,
      basisBps: 26,
    })
    mocks.classifyFineFundingOiRegime.mockResolvedValue({
      symbol: 'HYPE',
      regimeFine: 'crowded_long_exhaustion',
      regimeCoarse: 'crowded-longs',
      confidence: 0.81,
      fundingOi: {
        fundingRate: 0.00021,
        openInterestUsd: 42_000_000,
        volume24hUsd: 180_000_000,
        priceChange24hPct: 4.7,
        oiToVolumeRatio: 0.23,
      },
      marketState: {
        r_t: 0.012,
        F_t: 0.00021,
        OI_t: 42_000_000,
        V_t: 180_000_000,
        missing: ['dF_t', 'dOI_t'],
      },
      supportingEvidence: ['elevated funding'],
      contradictingEvidence: [],
      missingFields: ['dF_t', 'dOI_t'],
    })
    mocks.decideCounterDelaySkip.mockReturnValue({
      decision_id: '33333333-3333-3333-3333-333333333333',
      schema_version: 'counter-decision-v1',
      methodology_version: 'inv-akita-decision-v1.0.0',
      observed_at: '2026-07-12T08:31:00.000Z',
      data_as_of: '2026-07-12T08:30:55.000Z',
      venue: 'hyperliquid',
      asset: 'HYPE',
      source: {
        id: 'alfaclub_room_1659',
        side: 'LONG',
        entryPrice: 38.42,
        notionalUsd: 5000,
        leverage: 5,
        sourceTimestamp: '2026-07-12T08:30:00.000Z',
      },
      decision: 'COUNTER',
      counter_side: 'SHORT',
      confidence: 0.78,
      regime: 'crowded_long_exhaustion',
      regime_coarse: 'crowded-longs',
      market_state_vector: { missing: ['OF_t'] },
      supporting_evidence: ['elevated funding'],
      contradicting_evidence: [],
      invalidation: { price: 39.15, conditions: [] },
      suggested_risk_pct: 0.04,
      suggested_notional_usd: 200,
      estimated_cost_bps: 12,
      modeled_edge_bps: 40,
      edge_prior_version: 'inv-akita-edge-prior-v1.0.0-unvalidated',
      valid_for_minutes: 30,
      evaluation_horizons_hours: [1, 4, 8, 24],
      shadow_only: true,
    })
    mocks.recordDecisionLedgerEntry.mockResolvedValue({
      decisionId: '33333333-3333-3333-3333-333333333333',
      inserted: true,
    })
  })

  it('fundingOiRegime canary returns fine regime JSON with shadow_only', async () => {
    const result = await runFundingOiRegimeIntelJob({
      asset: 'HYPE',
      lookbackHours: 168,
      decisionHorizonHours: 8,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deliverable).toEqual(
      expect.objectContaining({
        asset: 'HYPE',
        regime: 'crowded_long_exhaustion',
        regime_coarse: 'crowded-longs',
        methodology_version: 'inv-akita-regime-v1.0.0',
        shadow_only: true,
      }),
    )
    expect(JSON.parse(result.responseText)).toEqual(
      expect.objectContaining({ regime: 'crowded_long_exhaustion', shadow_only: true }),
    )
  })

  it('counterTradeAnalysis persists DecisionRecord with virtuals idempotency key', async () => {
    const result = await runCounterTradeAnalysisJob({
      asset: 'HYPE',
      sourceSide: 'LONG',
      entryPrice: 38.42,
      notionalUsd: 5000,
      leverage: 5,
      sourceTimestamp: '2026-07-12T08:30:00.000Z',
      evaluationHorizonHours: 8,
      sourceId: 'alfaclub_room_1659',
      idempotencyKey: 'virtuals:8453:canary-job-1',
      acpJobId: 'canary-job-1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deliverable.decision).toBe('COUNTER')
    expect(result.deliverable.shadow_only).toBe(true)
    expect(result.deliverable.schema_version).toBe('counter-decision-v1')
    expect(mocks.recordDecisionLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'virtuals:8453:canary-job-1',
        acpJobId: 'canary-job-1',
        decision: expect.objectContaining({
          decision: 'COUNTER',
          asset: 'HYPE',
          shadow_only: true,
        }),
      }),
    )
  })

  it('kill switch forces structured SKIP without ledger writes', async () => {
    process.env.INV_AKITA_INTEL_KILL = '1'
    const funding = await runFundingOiRegimeIntelJob({
      asset: 'HYPE',
      lookbackHours: 168,
      decisionHorizonHours: 8,
    })
    const analysis = await runCounterTradeAnalysisJob({
      asset: 'HYPE',
      sourceSide: 'LONG',
      entryPrice: 38.42,
      sourceTimestamp: '2026-07-12T08:30:00.000Z',
      evaluationHorizonHours: 8,
      idempotencyKey: 'virtuals:8453:killed',
    })
    expect(funding.ok).toBe(false)
    expect(analysis.ok).toBe(false)
    if (funding.ok || analysis.ok) return
    expect(funding.reason).toBe('kill_switch')
    expect(analysis.reason).toBe('kill_switch')
    expect(mocks.recordDecisionLedgerEntry).not.toHaveBeenCalled()
    expect(mocks.getPerpMarketContext).not.toHaveBeenCalled()
  })
})
