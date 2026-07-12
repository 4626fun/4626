import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DecisionRecord } from './decisions/types.js'
import type { HyperliquidUserFillDetailed } from './hyperliquid.js'
import type { MarketStateVector } from './marketState/types.js'

const mocks = vi.hoisted(() => ({
  getPerpMarketContext: vi.fn(),
  classifyFineFundingOiRegime: vi.fn(),
  decideCounterDelaySkip: vi.fn(),
  recordDecisionLedgerEntry: vi.fn(),
  sendAlfaClubRoomText: vi.fn(),
}))

vi.mock('./hyperliquid.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hyperliquid.js')>()
  return {
    ...actual,
    getPerpMarketContext: mocks.getPerpMarketContext,
  }
})

vi.mock('./regimes/fundingOiRegimeFine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./regimes/fundingOiRegimeFine.js')>()
  return {
    ...actual,
    classifyFineFundingOiRegime: mocks.classifyFineFundingOiRegime,
  }
})

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

vi.mock('./chatBridge.js', () => ({
  sendAlfaClubRoomText: mocks.sendAlfaClubRoomText,
}))

import {
  formatInverseAkitaEntryAdvisoryPost,
  isEntryAdvisoryEnabled,
  postInverseAkitaEntryAdvisory,
} from './counterTradeEntryAdvisory.js'

function makeMarketState(missing: string[] = ['OF_t']): MarketStateVector {
  return {
    r_t: 0.01,
    dr_t: null,
    F_t: 0.0002,
    dF_t: null,
    OI_t: 1_000_000,
    dOI_t: null,
    V_t: 5_000_000,
    dV_t: null,
    B_t: null,
    dB_t: null,
    OF_t: null,
    L_t: null,
    missing,
    proxies: {
      oi_to_volume_24h: 0.2,
      price_change_4h_pct: null,
      price_change_24h_pct: 3.1,
    },
    normalization: 'absolute_thresholds_v2',
  }
}

function makeDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decision_id: '11111111-1111-1111-1111-111111111111',
    schema_version: 'counter-decision-v1',
    methodology_version: 'inv-akita-decision-v1.0.0',
    observed_at: '2026-07-12T08:31:00.000Z',
    data_as_of: '2026-07-12T08:30:55.000Z',
    venue: 'hyperliquid',
    asset: 'HYPE',
    source: {
      side: 'LONG',
      entryPrice: 38.42,
      sourceTimestamp: '2026-07-12T08:30:00.000Z',
    },
    decision: 'DELAY',
    counter_side: null,
    confidence: 0.61,
    regime: 'crowded_long_continuation',
    regime_coarse: 'crowded-longs',
    market_state_vector: makeMarketState(),
    supporting_evidence: ['elevated funding'],
    contradicting_evidence: [],
    invalidation: { price: null, conditions: [] },
    suggested_risk_pct: 0,
    suggested_notional_usd: 0,
    expected_holding_period_hours: 8,
    estimated_cost_bps: 12,
    modeled_edge_bps: 0,
    edge_prior_version: 'inv-akita-edge-prior-v1.0.0-unvalidated',
    valid_for_minutes: 45,
    evaluation_horizons_hours: [1, 4, 8, 24],
    outcome: null,
    shadow_only: true,
    disclaimer: 'Advisory only. Not investment advice. Does not execute trades.',
    ...overrides,
  }
}

function makeFill(overrides: Partial<HyperliquidUserFillDetailed> = {}): HyperliquidUserFillDetailed {
  return {
    closedPnl: 0,
    fee: 0.1,
    time: Date.parse('2026-07-12T08:30:00.000Z'),
    coin: 'HYPE',
    px: 38.42,
    sz: 100,
    dir: 'Open Long',
    side: 'long',
    startPosition: 0,
    leverage: 5,
    ...overrides,
  }
}

describe('isEntryAdvisoryEnabled', () => {
  it('is off by default and on for truthy flags', () => {
    expect(isEntryAdvisoryEnabled({})).toBe(false)
    expect(isEntryAdvisoryEnabled({ INV_AKITA_ENTRY_ADVISORY_ENABLED: '1' })).toBe(true)
    expect(isEntryAdvisoryEnabled({ INV_AKITA_ENTRY_ADVISORY_ENABLED: 'true' })).toBe(true)
    expect(isEntryAdvisoryEnabled({ INV_AKITA_ENTRY_ADVISORY_ENABLED: '0' })).toBe(false)
  })
})

describe('formatInverseAkitaEntryAdvisoryPost', () => {
  it('includes shadow framing, decision enum, and advisory disclaimer', () => {
    const text = formatInverseAkitaEntryAdvisoryPost({
      asset: 'HYPE',
      decision: makeDecision({ decision: 'COUNTER', counter_side: 'SHORT', confidence: 0.78 }),
    })
    expect(text).toContain('shadow')
    expect(text).toContain('**COUNTER**')
    expect(text).toContain('Advisory only. Did not affect this execution.')
    expect(text).toContain('crowded_long_continuation')
  })
})

describe('postInverseAkitaEntryAdvisory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      regimeFine: 'crowded_long_continuation',
      regimeCoarse: 'crowded-longs',
      confidence: 0.7,
      marketState: makeMarketState(),
      supportingEvidence: ['elevated funding'],
      contradictingEvidence: [],
      missingFields: ['OF_t'],
      fundingOi: {},
      methodologyVersion: 'inv-akita-regime-v1.0.0',
      shadowOnly: true,
    })
    mocks.decideCounterDelaySkip.mockReturnValue(makeDecision())
    mocks.recordDecisionLedgerEntry.mockResolvedValue({
      decisionId: '11111111-1111-1111-1111-111111111111',
      inserted: true,
    })
    mocks.sendAlfaClubRoomText.mockResolvedValue({ lane: 'bot_token_without_reply_id', messageId: 'm1' })
  })

  it('posts advisory, records ledger, and never throws on missing market context', async () => {
    const posted = await postInverseAkitaEntryAdvisory({
      runtimeRoomId: '1659',
      postRoomId: '1659',
      eventKey: 'evt-1',
      pair: 'HYPE',
      userFill: makeFill(),
      counterSide: 'short',
      counterNotionalUsd: 500,
    })
    expect(posted.posted).toBe(true)
    expect(posted.decision?.decision).toBe('DELAY')
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '1659',
        text: expect.stringContaining('Advisory only. Did not affect this execution.'),
      }),
    )
    expect(mocks.recordDecisionLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'hermit-entry:1659:evt-1',
      }),
    )

    mocks.getPerpMarketContext.mockResolvedValueOnce(null)
    const skipped = await postInverseAkitaEntryAdvisory({
      runtimeRoomId: '1659',
      postRoomId: '1659',
      eventKey: 'evt-2',
      pair: 'HYPE',
      userFill: makeFill(),
      counterSide: 'short',
      counterNotionalUsd: 500,
    })
    expect(skipped).toEqual({ posted: false, decision: null })
  })
})
