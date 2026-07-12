import { randomUUID } from 'node:crypto'

import { getPerpMarketContext, getAllPerpMarketContexts, getUserFillsByTimeDetailed } from '../../../../_lib/alfaclub/hyperliquid.js'
import { classifyFineFundingOiRegime } from '../../../../_lib/alfaclub/regimes/fundingOiRegimeFine.js'
import {
  decideCounterDelaySkip,
  isIntelKillSwitchEnabled,
  type DecisionRecord,
} from '../../../../_lib/alfaclub/decisions/counterDecisionEngine.js'
import { recordDecisionLedgerEntry } from '../../../../_lib/alfaclub/decisions/decisionLedgerStore.js'
import { selectLiquidUniverse } from '../../../../_lib/alfaclub/marketState/ingestSampler.js'
import { runSourceStrategyAudit } from '../../../../_lib/alfaclub/audits/sourceStrategyAudit.js'
import { recommendPortfolioHedge } from '../../../../_lib/alfaclub/portfolio/hedgeRecommendation.js'
import { FINE_REGIME_METHODOLOGY_VERSION } from '../../../../_lib/alfaclub/regimes/fundingOiRegimeFine.js'
import type { FineRegime } from '../../../../_lib/alfaclub/regimes/regimeTaxonomy.js'

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || ''
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export type IntelJobFailure = {
  ok: false
  reason: 'unpaid' | 'stale_data' | 'venue_outage' | 'insufficient_coverage' | 'invalid_request' | 'kill_switch'
  responseText: string
  reject: boolean
}

export type IntelJobSuccess<T> = {
  ok: true
  responseText: string
  deliverable: T
}

export type IntelJobResult<T> = IntelJobSuccess<T> | IntelJobFailure

function fail(
  reason: IntelJobFailure['reason'],
  message: string,
  reject = reason !== 'invalid_request',
): IntelJobFailure {
  return { ok: false, reason, responseText: message, reject }
}

function killOrNull(): IntelJobFailure | null {
  if (!isIntelKillSwitchEnabled()) return null
  return fail(
    'kill_switch',
    JSON.stringify({
      decision: 'SKIP',
      regime: 'insufficient_data',
      shadow_only: true,
      reason: 'INV_AKITA_INTEL_KILL=1',
    }),
    false,
  )
}

export function parseFundingOiRegimeRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): { asset: string; lookbackHours: number; decisionHorizonHours: number } | null {
  const name = offeringName.toLowerCase()
  if (name !== 'fundingoiregime' && name !== 'fundingoiregimeshadow') return null
  const req = parseJsonObject(requirementJson) ?? {}
  const assetRaw =
    typeof req.asset === 'string'
      ? req.asset
      : typeof req.symbol === 'string'
        ? req.symbol
        : requirementJson
  const asset = normalizeSymbol(assetRaw)
  if (!asset) return null
  return {
    asset,
    lookbackHours:
      typeof req.lookback_hours === 'number' && Number.isFinite(req.lookback_hours)
        ? Math.max(24, Math.min(720, Math.floor(req.lookback_hours)))
        : 168,
    decisionHorizonHours:
      typeof req.decision_horizon_hours === 'number' && Number.isFinite(req.decision_horizon_hours)
        ? Math.max(1, Math.min(72, Math.floor(req.decision_horizon_hours)))
        : 4,
  }
}

export function parseCounterTradeAnalysisRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): {
  asset: string
  sourceSide: 'LONG' | 'SHORT'
  entryPrice: number
  notionalUsd?: number
  leverage?: number
  sourceTimestamp: string
  evaluationHorizonHours: number
  sourceId?: string
} | null {
  if (offeringName.toLowerCase() !== 'countertradeanalysis') return null
  const req = parseJsonObject(requirementJson)
  if (!req) return null
  const asset = typeof req.asset === 'string' ? normalizeSymbol(req.asset) : ''
  const sourceSide = req.source_side === 'LONG' || req.source_side === 'SHORT' ? req.source_side : null
  const entryPrice = typeof req.entry_price === 'number' ? req.entry_price : Number.NaN
  const sourceTimestamp = typeof req.source_timestamp === 'string' ? req.source_timestamp : ''
  if (!asset || !sourceSide || !(entryPrice > 0) || !sourceTimestamp) return null
  return {
    asset,
    sourceSide,
    entryPrice,
    notionalUsd:
      typeof req.position_notional_usd === 'number' && req.position_notional_usd > 0
        ? req.position_notional_usd
        : undefined,
    leverage: typeof req.leverage === 'number' && req.leverage > 0 ? req.leverage : undefined,
    sourceTimestamp,
    evaluationHorizonHours:
      typeof req.evaluation_horizon_hours === 'number'
        ? Math.max(1, Math.min(72, Math.floor(req.evaluation_horizon_hours)))
        : 8,
    sourceId: typeof req.source_id === 'string' ? req.source_id : undefined,
  }
}

export function parseCrowdingSnapshotRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): {
  universe: 'hyperliquid_top_50' | 'hyperliquid_majors'
  resultLimit: number
  minimumDailyVolumeUsd: number
} | null {
  if (offeringName.toLowerCase() !== 'crowdingsnapshot') return null
  const req = parseJsonObject(requirementJson) ?? {}
  return {
    universe:
      req.universe === 'hyperliquid_majors' ? 'hyperliquid_majors' : 'hyperliquid_top_50',
    resultLimit:
      typeof req.result_limit === 'number'
        ? Math.max(1, Math.min(50, Math.floor(req.result_limit)))
        : 10,
    minimumDailyVolumeUsd:
      typeof req.minimum_daily_volume_usd === 'number'
        ? req.minimum_daily_volume_usd
        : 10_000_000,
  }
}

export function parseSourceStrategyAuditRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): {
  sourceType: 'wallet' | 'alfaclub_room' | 'trade_export'
  sourceId: string
  feeBps: number
  slippageBps: number
} | null {
  if (offeringName.toLowerCase() !== 'sourcestrategyaudit') return null
  const req = parseJsonObject(requirementJson)
  if (!req || typeof req.source !== 'object' || !req.source) return null
  const source = req.source as Record<string, unknown>
  const sourceType =
    source.type === 'wallet' || source.type === 'alfaclub_room' || source.type === 'trade_export'
      ? source.type
      : null
  const sourceId = typeof source.id === 'string' ? source.id.trim() : ''
  if (!sourceType || !sourceId) return null
  return {
    sourceType,
    sourceId,
    feeBps: typeof req.fee_bps === 'number' ? req.fee_bps : 3,
    slippageBps: typeof req.slippage_bps === 'number' ? req.slippage_bps : 5,
  }
}

export function parsePortfolioHedgeRequestFromOffering(
  offeringName: string,
  requirementJson: string,
): Parameters<typeof recommendPortfolioHedge>[0] | null {
  if (offeringName.toLowerCase() !== 'portfoliohedgerecommendation') return null
  const req = parseJsonObject(requirementJson)
  if (!req) return null
  if (!Array.isArray(req.positions) || typeof req.collateral_usd !== 'number') return null
  if (
    req.risk_objective !== 'reduce_8h_drawdown' &&
    req.risk_objective !== 'reduce_beta' &&
    req.risk_objective !== 'reduce_liquidation_proximity'
  ) {
    return null
  }
  const positions = req.positions
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const asset = typeof row.asset === 'string' ? normalizeSymbol(row.asset) : ''
      const side = row.side === 'LONG' || row.side === 'SHORT' ? row.side : null
      const notionalUsd =
        typeof row.notional_usd === 'number'
          ? row.notional_usd
          : typeof row.notionalUsd === 'number'
            ? row.notionalUsd
            : Number.NaN
      if (!asset || !side || !Number.isFinite(notionalUsd)) return null
      return {
        asset,
        side,
        notionalUsd,
        entryPrice: typeof row.entry_price === 'number' ? row.entry_price : undefined,
        leverage: typeof row.leverage === 'number' ? row.leverage : undefined,
        liquidationPrice:
          typeof row.liquidation_price === 'number' ? row.liquidation_price : undefined,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
  if (positions.length === 0) return null
  return {
    positions,
    collateralUsd: req.collateral_usd,
    maximumAdditionalMarginUsd:
      typeof req.maximum_additional_margin_usd === 'number'
        ? req.maximum_additional_margin_usd
        : undefined,
    riskObjective: req.risk_objective,
  }
}

export async function runFundingOiRegimeIntelJob(params: {
  asset: string
  lookbackHours: number
  decisionHorizonHours: number
  idempotencyKey?: string
}): Promise<IntelJobResult<Record<string, unknown>>> {
  const killed = killOrNull()
  if (killed) return killed

  const context = await getPerpMarketContext(params.asset)
  if (!context) {
    return fail('venue_outage', 'Funding/OI analysis failed: Hyperliquid market context unavailable.')
  }

  const observedAtMs = Date.now()
  const fine = await classifyFineFundingOiRegime({
    snapshot: {
      symbol: params.asset,
      observedAtMs,
      markPriceUsd: context.markPriceUsd,
      fundingRate: context.fundingRate,
      openInterestUsd: context.openInterestUsd,
      volume24hUsd: context.volume24hUsd,
      priceChange24hPct: context.priceChange24hPct,
      oraclePriceUsd: context.oraclePriceUsd ?? null,
      basisBps: context.basisBps ?? null,
    },
    lookbackHours: params.lookbackHours,
  })

  const deliverable = {
    asset: fine.symbol,
    regime: fine.regimeFine,
    regime_coarse: fine.regimeCoarse,
    confidence: Number(fine.confidence.toFixed(4)),
    funding_rate: fine.fundingOi.fundingRate,
    open_interest_usd: fine.fundingOi.openInterestUsd,
    volume_24h_usd: fine.fundingOi.volume24hUsd,
    price_return_4h: null,
    price_return_24h:
      fine.fundingOi.priceChange24hPct != null ? fine.fundingOi.priceChange24hPct / 100 : null,
    oi_to_volume_24h: fine.fundingOi.oiToVolumeRatio,
    z_scores: {
      funding_z: null,
      oi_delta_z: null,
      volume_delta_z: null,
      return_z: null,
    },
    supporting_evidence: fine.supportingEvidence,
    contradicting_evidence: fine.contradictingEvidence,
    missing_fields: fine.missingFields,
    data_timestamp: new Date(observedAtMs).toISOString(),
    methodology_version: FINE_REGIME_METHODOLOGY_VERSION,
    decision_horizon_hours: params.decisionHorizonHours,
    human_summary: `${fine.symbol} classified ${fine.regimeFine}. Confidence ${fine.confidence.toFixed(2)}. Missing: ${fine.missingFields.join(', ') || 'none'}. Advisory only.`,
    shadow_only: true,
  }

  return {
    ok: true,
    deliverable,
    responseText: JSON.stringify(deliverable, null, 2),
  }
}

export async function runCounterTradeAnalysisJob(params: {
  asset: string
  sourceSide: 'LONG' | 'SHORT'
  entryPrice: number
  notionalUsd?: number
  leverage?: number
  sourceTimestamp: string
  evaluationHorizonHours: number
  sourceId?: string
  idempotencyKey: string
  acpJobId?: string
}): Promise<IntelJobResult<DecisionRecord>> {
  const killed = killOrNull()
  if (killed) return killed

  const context = await getPerpMarketContext(params.asset)
  if (!context) {
    return fail('venue_outage', 'counterTradeAnalysis failed: Hyperliquid market context unavailable.')
  }
  if (context.markPriceUsd == null || context.markPriceUsd <= 0) {
    return fail('insufficient_coverage', 'counterTradeAnalysis failed: mark price unavailable.')
  }

  const observedAtMs = Date.now()
  const dataAgeSeconds = 0
  const fine = await classifyFineFundingOiRegime({
    snapshot: {
      symbol: params.asset,
      observedAtMs,
      markPriceUsd: context.markPriceUsd,
      fundingRate: context.fundingRate,
      openInterestUsd: context.openInterestUsd,
      volume24hUsd: context.volume24hUsd,
      priceChange24hPct: context.priceChange24hPct,
      oraclePriceUsd: context.oraclePriceUsd ?? null,
      basisBps: context.basisBps ?? null,
    },
  })

  const decision = decideCounterDelaySkip({
    decisionId: randomUUID(),
    observedAt: new Date(observedAtMs).toISOString(),
    dataAsOf: new Date(observedAtMs).toISOString(),
    asset: params.asset,
    source: {
      id: params.sourceId,
      side: params.sourceSide,
      entryPrice: params.entryPrice,
      notionalUsd: params.notionalUsd,
      leverage: params.leverage,
      sourceTimestamp: params.sourceTimestamp,
    },
    regime: fine.regimeFine,
    regimeCoarse: fine.regimeCoarse,
    marketState: fine.marketState,
    supportingEvidence: fine.supportingEvidence,
    contradictingEvidence: fine.contradictingEvidence,
    dataQuality: fine.regimeFine === 'insufficient_data' ? 'bad' : 'ok',
    staleSeconds: dataAgeSeconds,
    statedCapitalUsd: params.notionalUsd,
  })

  decision.expected_holding_period_hours = params.evaluationHorizonHours

  await recordDecisionLedgerEntry({
    decision,
    idempotencyKey: params.idempotencyKey,
    acpJobId: params.acpJobId,
  }).catch(() => {})

  return {
    ok: true,
    deliverable: decision,
    responseText: JSON.stringify(decision, null, 2),
  }
}

export async function runCrowdingSnapshotJob(params: {
  resultLimit: number
  minimumDailyVolumeUsd: number
  universe: 'hyperliquid_top_50' | 'hyperliquid_majors'
}): Promise<IntelJobResult<Record<string, unknown>>> {
  const killed = killOrNull()
  if (killed) return killed

  const contexts = await getAllPerpMarketContexts()
  if (!contexts) return fail('venue_outage', 'crowdingSnapshot failed: Hyperliquid unavailable.')

  const topN = params.universe === 'hyperliquid_majors' ? 10 : 50
  const qualified = selectLiquidUniverse(contexts, {
    topN,
    minimumDailyVolumeUsd: params.minimumDailyVolumeUsd,
  })

  const rows = []
  let stale = 0
  for (const context of qualified.slice(0, Math.max(params.resultLimit * 3, params.resultLimit))) {
    if (context.fundingRate == null || context.volume24hUsd == null) {
      stale += 1
      continue
    }
    const fundingAbs = Math.abs(context.fundingRate)
    const score = Math.min(
      100,
      Math.round(fundingAbs * 1_000_000 + (context.openInterestUsd ?? 0) / Math.max(1, context.volume24hUsd) * 40),
    )
    const stage =
      fundingAbs >= 0.00025
        ? 'exhaustion'
        : fundingAbs >= 0.00008
          ? 'late_crowding'
          : fundingAbs >= 0.00003
            ? 'mid_crowding'
            : 'early_crowding'
    rows.push({
      asset: context.symbol,
      score,
      stage,
      funding_z: null,
      oi_delta_z: null,
      basis_z: null,
      price_return_4h: null,
      price_return_24h: context.priceChange24hPct,
      side: context.fundingRate >= 0 ? 'long' : 'short',
      warning: stage === 'exhaustion' ? 'extreme funding; fade risk elevated' : undefined,
    })
  }

  const crowdedLongs = rows
    .filter((row) => row.side === 'long')
    .sort((a, b) => b.score - a.score)
    .slice(0, params.resultLimit)
    .map(({ side: _side, ...rest }) => rest)
  const crowdedShorts = rows
    .filter((row) => row.side === 'short')
    .sort((a, b) => b.score - a.score)
    .slice(0, params.resultLimit)
    .map(({ side: _side, ...rest }) => rest)

  const deliverable = {
    crowded_longs: crowdedLongs,
    crowded_shorts: crowdedShorts,
    generated_at: new Date().toISOString(),
    methodology_version: 'crowding-snapshot-v1.0.0',
    coverage: {
      assets_scanned: contexts.length,
      assets_qualified: qualified.length,
      stale_assets: stale,
    },
    shadow_only: true,
  }

  return { ok: true, deliverable, responseText: JSON.stringify(deliverable, null, 2) }
}

export async function runSourceStrategyAuditJob(params: {
  sourceType: 'wallet' | 'alfaclub_room' | 'trade_export'
  sourceId: string
  feeBps: number
  slippageBps: number
}): Promise<IntelJobResult<Record<string, unknown>>> {
  const killed = killOrNull()
  if (killed) return killed
  try {
    const deliverable = await runSourceStrategyAudit({
      ...params,
      readFills: getUserFillsByTimeDetailed,
    })
    if (deliverable.sample_size < 100 && params.sourceType !== 'trade_export') {
      return fail(
        'insufficient_coverage',
        `sourceStrategyAudit requires ≥100 labeled trades; got ${deliverable.sample_size}.`,
      )
    }
    return { ok: true, deliverable, responseText: JSON.stringify(deliverable, null, 2) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('invalid_request', `sourceStrategyAudit failed: ${message}`)
  }
}

export async function runPortfolioHedgeJob(
  input: NonNullable<ReturnType<typeof parsePortfolioHedgeRequestFromOffering>>,
): Promise<IntelJobResult<Record<string, unknown>>> {
  const killed = killOrNull()
  if (killed) return killed
  const deliverable = recommendPortfolioHedge(input)
  return { ok: true, deliverable, responseText: JSON.stringify(deliverable, null, 2) }
}

export type { FineRegime, DecisionRecord }
