import type { CounterDecision, Side } from './types.js'

export function suggestAdvisorySize(params: {
  decision: CounterDecision
  confidence: number
  statedCapitalUsd?: number
  sourceLeverage?: number
  venueMaxLeverage?: number
  cCounter?: number
}): {
  suggestedRiskPct: number
  suggestedNotionalUsd: number
  leverageCap: number
} {
  const cCounter = params.cCounter ?? 0.65
  if (params.decision !== 'COUNTER' || params.confidence < cCounter) {
    return { suggestedRiskPct: 0, suggestedNotionalUsd: 0, leverageCap: 0 }
  }

  const capital = params.statedCapitalUsd ?? 10_000
  const riskPct = Math.max(0.01, Math.min(0.05, 0.02 + (params.confidence - cCounter) * 0.1))
  const venueCap = (params.venueMaxLeverage ?? 20) * 0.5
  const leverageCap = Math.min(params.sourceLeverage ?? 5, venueCap, 10)
  const notional = capital * riskPct * Math.max(1, leverageCap)
  return {
    suggestedRiskPct: Number(riskPct.toFixed(4)),
    suggestedNotionalUsd: Number(notional.toFixed(2)),
    leverageCap: Number(leverageCap.toFixed(2)),
  }
}

export function invalidationPrice(params: {
  sourceSide: Side
  entryPrice: number
  counterSide: Side | null
}): number | null {
  if (!params.counterSide || !Number.isFinite(params.entryPrice) || params.entryPrice <= 0) {
    return null
  }
  // Conservative: invalidate if source continues ~2% in its favor.
  if (params.sourceSide === 'LONG') return Number((params.entryPrice * 1.02).toFixed(6))
  return Number((params.entryPrice * 0.98).toFixed(6))
}
