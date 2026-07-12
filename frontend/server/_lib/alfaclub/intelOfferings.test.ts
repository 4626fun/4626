import { describe, expect, it } from 'vitest'

import {
  parseCounterTradeAnalysisRequestFromOffering,
  parseCrowdingSnapshotRequestFromOffering,
  parseFundingOiRegimeRequestFromOffering,
  parsePortfolioHedgeRequestFromOffering,
  parseSourceStrategyAuditRequestFromOffering,
} from '../../../server/agents/eliza/plugins/virtuals/intelJobs.js'
import { recommendPortfolioHedge } from './portfolio/hedgeRecommendation.js'
import { runSourceStrategyAudit } from './audits/sourceStrategyAudit.js'

describe('intel offering parsers', () => {
  it('parses canonical fundingOiRegime and shadow alias', () => {
    expect(
      parseFundingOiRegimeRequestFromOffering('fundingOiRegime', '{"asset":"btc"}'),
    ).toEqual(expect.objectContaining({ asset: 'BTC', lookbackHours: 168 }))
    expect(
      parseFundingOiRegimeRequestFromOffering('fundingOiRegimeShadow', '{"symbol":"eth"}'),
    ).toEqual(expect.objectContaining({ asset: 'ETH' }))
    expect(
      parseFundingOiRegimeRequestFromOffering('counterTradeSignal', '{"symbol":"ETH"}'),
    ).toBeNull()
  })

  it('parses flagship counterTradeAnalysis requirements', () => {
    const parsed = parseCounterTradeAnalysisRequestFromOffering(
      'counterTradeAnalysis',
      JSON.stringify({
        venue: 'hyperliquid',
        asset: 'HYPE',
        source_side: 'LONG',
        entry_price: 38.42,
        position_notional_usd: 5000,
        leverage: 5,
        source_timestamp: '2026-07-12T08:30:00Z',
        evaluation_horizon_hours: 8,
      }),
    )
    expect(parsed).toEqual(
      expect.objectContaining({
        asset: 'HYPE',
        sourceSide: 'LONG',
        entryPrice: 38.42,
        evaluationHorizonHours: 8,
      }),
    )
  })

  it('parses crowding, audit, and hedge offerings', () => {
    expect(
      parseCrowdingSnapshotRequestFromOffering('crowdingSnapshot', '{}'),
    ).toEqual(expect.objectContaining({ resultLimit: 10 }))
    expect(
      parseSourceStrategyAuditRequestFromOffering(
        'sourceStrategyAudit',
        '{"source":{"type":"alfaclub_room","id":"1659"}}',
      ),
    ).toEqual(expect.objectContaining({ sourceType: 'alfaclub_room', sourceId: '1659' }))
    expect(
      parsePortfolioHedgeRequestFromOffering(
        'portfolioHedgeRecommendation',
        JSON.stringify({
          positions: [{ asset: 'HYPE', side: 'LONG', notional_usd: 5000 }],
          collateral_usd: 2000,
          risk_objective: 'reduce_8h_drawdown',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        collateralUsd: 2000,
        riskObjective: 'reduce_8h_drawdown',
      }),
    )
  })
})

describe('portfolio hedge advisory', () => {
  it('returns modeled reduction bands and residual risks', () => {
    const result = recommendPortfolioHedge({
      positions: [
        { asset: 'HYPE', side: 'LONG', notionalUsd: 5000 },
        { asset: 'BTC', side: 'LONG', notionalUsd: 2000 },
      ],
      collateralUsd: 3000,
      riskObjective: 'reduce_8h_drawdown',
    })
    expect(result.shadow_only).toBe(true)
    expect(result.candidateHedge).not.toBeNull()
    expect(result.residualRisks.join(' ')).toContain('does not eliminate risk')
  })
})

describe('source strategy audit MVP', () => {
  it('computes baseline expectancies from fills', async () => {
    const result = await runSourceStrategyAudit({
      sourceType: 'wallet',
      sourceId: '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
      feeBps: 3,
      slippageBps: 5,
      readFills: async () => [
        {
          closedPnl: -20,
          fee: 1,
          time: Date.now(),
          coin: 'HYPE',
          px: 40,
          sz: 10,
          dir: 'Open Long',
          side: 'long',
          startPosition: 0,
          leverage: 5,
        },
        {
          closedPnl: 10,
          fee: 1,
          time: Date.now(),
          coin: 'HYPE',
          px: 40,
          sz: 5,
          dir: 'Open Short',
          side: 'short',
          startPosition: 0,
          leverage: 3,
        },
      ],
    })
    expect(result.sample_size).toBe(2)
    expect(result.methodology_version).toBe('source-audit-v1')
    expect(result.shadow_only).toBe(true)
  })
})
