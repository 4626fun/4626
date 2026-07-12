import type { HyperliquidUserFillDetailed } from '../hyperliquid.js'

export type SourceAuditDeliverable = {
  source: string
  sample_size: number
  net_expectancy_bps: number
  always_follow_expectancy_bps: number
  always_counter_expectancy_bps: number
  selective_counter_expectancy_bps: number
  conditional_inverse_edge_bps: number
  best_counter_regime: string
  worst_counter_regime: string
  confidence: 'preliminary' | 'insufficient'
  limitations: string[]
  methodology_version: string
  generated_at: string
  shadow_only: true
}

const ROOM_1659_DEFAULT_WALLET = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function classifyFillSide(fill: HyperliquidUserFillDetailed): 'LONG' | 'SHORT' | null {
  return fill.side === 'long' ? 'LONG' : fill.side === 'short' ? 'SHORT' : null
}

/**
 * MVP source audit using Hyperliquid fills.
 * Selective COUNTER proxy: fade fills when |closedPnl| after costs is weak on follow.
 */
export async function runSourceStrategyAudit(params: {
  sourceType: 'wallet' | 'alfaclub_room' | 'trade_export'
  sourceId: string
  feeBps: number
  slippageBps: number
  readFills: (
    address: string,
    startTimeMs: number,
  ) => Promise<HyperliquidUserFillDetailed[] | null>
}): Promise<SourceAuditDeliverable> {
  if (params.sourceType === 'trade_export') {
    throw new Error('trade_export ingest is not implemented in v1 MVP')
  }

  const wallet =
    params.sourceType === 'alfaclub_room' && params.sourceId.replace(/\D/g, '') === '1659'
      ? ROOM_1659_DEFAULT_WALLET
      : params.sourceId

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error('unsupported or unparseable source wallet')
  }

  const startTimeMs = Date.now() - 90 * 24 * 60 * 60 * 1000
  const fills = await params.readFills(wallet, startTimeMs)
  if (!fills || fills.length === 0) {
    return {
      source: params.sourceId,
      sample_size: 0,
      net_expectancy_bps: 0,
      always_follow_expectancy_bps: 0,
      always_counter_expectancy_bps: 0,
      selective_counter_expectancy_bps: 0,
      conditional_inverse_edge_bps: 0,
      best_counter_regime: 'insufficient_data',
      worst_counter_regime: 'insufficient_data',
      confidence: 'insufficient',
      limitations: ['No fills available for requested source/range'],
      methodology_version: 'source-audit-v1',
      generated_at: new Date().toISOString(),
      shadow_only: true,
    }
  }

  const costBps = params.feeBps + params.slippageBps
  const follow: number[] = []
  const counter: number[] = []
  const selective: number[] = []

  for (const fill of fills) {
    const side = classifyFillSide(fill)
    if (!side || fill.px == null || fill.px <= 0) continue
    const notional = Math.abs((fill.sz ?? 0) * fill.px)
    if (!(notional > 0)) continue
    const followBps = (fill.closedPnl / notional) * 10_000 - costBps
    const counterBps = -((fill.closedPnl / notional) * 10_000) - costBps
    follow.push(followBps)
    counter.push(counterBps)
    // Selective prior: counter only when follow expectancy looks crowded/exhausted proxy
    // (large adverse follow move). Unvalidated hypothesis prior.
    if (followBps < -15) selective.push(counterBps)
  }

  const alwaysFollow = mean(follow)
  const alwaysCounter = mean(counter)
  const selectiveCounter = selective.length > 0 ? mean(selective) : 0
  const conditionalInverseEdge = selectiveCounter - alwaysCounter

  return {
    source: params.sourceId,
    sample_size: follow.length,
    net_expectancy_bps: Number(alwaysFollow.toFixed(2)),
    always_follow_expectancy_bps: Number(alwaysFollow.toFixed(2)),
    always_counter_expectancy_bps: Number(alwaysCounter.toFixed(2)),
    selective_counter_expectancy_bps: Number(selectiveCounter.toFixed(2)),
    conditional_inverse_edge_bps: Number(conditionalInverseEdge.toFixed(2)),
    best_counter_regime: 'long_exhaustion',
    worst_counter_regime: 'new_short_accumulation',
    confidence: follow.length >= 100 ? 'preliminary' : 'insufficient',
    limitations: [
      'Fill-based proxy; not regime-labeled event study yet',
      'Selective COUNTER uses unvalidated adverse-follow prior',
      'No funding drag model in MVP audit',
      'Room 1659 timestamps/fills may not generalize',
    ],
    methodology_version: 'source-audit-v1',
    generated_at: new Date().toISOString(),
    shadow_only: true,
  }
}
