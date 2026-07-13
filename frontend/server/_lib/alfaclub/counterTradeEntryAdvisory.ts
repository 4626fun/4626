/**
 * Post-execution InverseAKITA advisory room card.
 * Surfacing only — never gates, sizes, or vetoes live counter-trade execution.
 */

import { randomUUID } from 'node:crypto'

import { logger } from '../infra/logger.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import {
  decideCounterDelaySkip,
  type DecisionRecord,
} from './decisions/counterDecisionEngine.js'
import { recordDecisionLedgerEntry } from './decisions/decisionLedgerStore.js'
import { getPerpMarketContext, type HyperliquidUserFillDetailed } from './hyperliquid.js'
import { classifyFineFundingOiRegime } from './regimes/fundingOiRegimeFine.js'

declare const process: { env: Record<string, string | undefined> }

export function isEntryAdvisoryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = String(env.INV_AKITA_ENTRY_ADVISORY_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function fillNotionalUsd(fill: HyperliquidUserFillDetailed): number | undefined {
  const px = fill.px
  const sz = fill.sz
  if (px == null || sz == null || !Number.isFinite(px) || !Number.isFinite(sz)) return undefined
  const notional = Math.abs(px * sz)
  return notional > 0 ? notional : undefined
}

export function formatInverseAkitaEntryAdvisoryPost(params: {
  asset: string
  decision: DecisionRecord
}): string {
  const { decision, asset } = params
  const contradictingEvidence = decision.contradicting_evidence
  const evidence =
    decision.supporting_evidence[0] ??
    contradictingEvidence[contradictingEvidence.length - 1] ??
    'n/a'
  const missing = decision.market_state_vector.missing.slice(0, 4)
  const missingLine =
    missing.length > 0 ? `Missing fields: ${missing.join(', ')}` : 'Missing fields: none'

  return [
    '**InverseAKITA advisory** (shadow)',
    '',
    `${asset}/USDC · regime \`${decision.regime}\` · coarse \`${decision.regime_coarse ?? 'n/a'}\``,
    `Advisory decision: **${decision.decision}** · confidence ${decision.confidence.toFixed(2)}`,
    `Evidence: ${evidence}`,
    missingLine,
    '',
    '_Advisory only. Did not affect this execution._',
  ].join('\n')
}

export async function postInverseAkitaEntryAdvisory(params: {
  runtimeRoomId: string
  postRoomId: string
  eventKey: string
  pair: string
  userFill: HyperliquidUserFillDetailed
  counterSide: 'long' | 'short'
  counterNotionalUsd: number
  getContext?: typeof getPerpMarketContext
  classifyFine?: typeof classifyFineFundingOiRegime
  decide?: typeof decideCounterDelaySkip
  recordLedger?: typeof recordDecisionLedgerEntry
  postText?: typeof sendAlfaClubRoomText
}): Promise<{ posted: boolean; decision: DecisionRecord | null }> {
  const getContext = params.getContext ?? getPerpMarketContext
  const classifyFine = params.classifyFine ?? classifyFineFundingOiRegime
  const decide = params.decide ?? decideCounterDelaySkip
  const recordLedger = params.recordLedger ?? recordDecisionLedgerEntry
  const postText = params.postText ?? sendAlfaClubRoomText

  const asset = params.pair.trim().toUpperCase()
  const context = await getContext(asset)
  if (!context) {
    logger.warn('counter_trade.entry_advisory_skipped', {
      roomId: params.runtimeRoomId,
      pair: asset,
      reason: 'market_context_unavailable',
    })
    return { posted: false, decision: null }
  }

  const observedAtMs = Date.now()
  const fine = await classifyFine({
    snapshot: {
      symbol: asset,
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

  const sourceSide = params.userFill.side === 'short' ? 'SHORT' : 'LONG'
  const entryPrice =
    params.userFill.px != null && Number.isFinite(params.userFill.px) && params.userFill.px > 0
      ? params.userFill.px
      : context.markPriceUsd != null && context.markPriceUsd > 0
        ? context.markPriceUsd
        : 0
  if (!(entryPrice > 0)) {
    logger.warn('counter_trade.entry_advisory_skipped', {
      roomId: params.runtimeRoomId,
      pair: asset,
      reason: 'entry_price_unavailable',
    })
    return { posted: false, decision: null }
  }

  const decision = decide({
    decisionId: randomUUID(),
    observedAt: new Date(observedAtMs).toISOString(),
    dataAsOf: new Date(observedAtMs).toISOString(),
    asset,
    source: {
      id: `hermit_entry:${params.runtimeRoomId}`,
      side: sourceSide,
      entryPrice,
      notionalUsd: fillNotionalUsd(params.userFill) ?? params.counterNotionalUsd,
      leverage: params.userFill.leverage ?? undefined,
      sourceTimestamp: new Date(params.userFill.time).toISOString(),
    },
    regime: fine.regimeFine,
    regimeCoarse: fine.regimeCoarse,
    marketState: fine.marketState,
    supportingEvidence: fine.supportingEvidence,
    contradictingEvidence: fine.contradictingEvidence,
    dataQuality: fine.regimeFine === 'insufficient_data' ? 'bad' : 'ok',
    staleSeconds: 0,
    statedCapitalUsd: params.counterNotionalUsd,
  })

  await recordLedger({
    decision,
    idempotencyKey: `hermit-entry:${params.runtimeRoomId}:${params.eventKey}`,
    acpJobId: null,
  }).catch(() => {})

  const text = formatInverseAkitaEntryAdvisoryPost({ asset, decision })
  const send = await postText({
    roomId: params.postRoomId,
    text,
  })

  logger.info('counter_trade.entry_advisory_posted', {
    roomId: params.runtimeRoomId,
    postRoomId: params.postRoomId,
    pair: asset,
    decision: decision.decision,
    regime: decision.regime,
    lane: send.lane,
    executedCounterSide: params.counterSide,
  })

  return { posted: true, decision }
}
