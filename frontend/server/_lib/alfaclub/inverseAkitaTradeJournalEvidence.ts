import { createHash } from 'node:crypto'

import type {
  AnalysisVerdict,
  AttributionQuality,
  EvidenceLayer,
  OpinionSide,
  PositionLifecycleEventType,
  PositionLifecycleState,
} from './inverseOpinionTradeStore.js'

export type EvidenceAvailability = 'available' | 'unavailable'

export type InverseAkitaTradeJournalEvidenceItem = {
  evidenceId: string
  key: string
  layer: EvidenceLayer
  availability: EvidenceAvailability
  value: unknown
  provenance: string
  dataAsOf: string
}

export type RecordedAuthorAccess = {
  eligible: boolean
  reason: string
  stakedKeys: number | null
}

export type PriorTradeJournalAnalysis = {
  analysisId: string
  createdAt: string
  verdict: AnalysisVerdict
  confidence: number
  interpretation: string
}

export type InverseAkitaTradeJournalEvidenceInput = {
  lifecycle: {
    lifecycleId: string
    state: PositionLifecycleState
    market: string
    side: OpinionSide
    openedAt: string
    closedAt: string | null
    attributionQuality: AttributionQuality
    reconciliationGeneration: number
  }
  source: {
    decisionId: string
    roomId: string
    sourceMessageId: string
    sourceHash: string
    sourceTimestamp: string
    sourceSide: OpinionSide
    inverseSide: OpinionSide
    normalizedMarket: string
    /** Audit-only input. Deliberately absent from the assembled bundle. */
    sourceExcerpt?: string | null
    /** Publication-only input. Deliberately absent from the assembled bundle. */
    publicAuthorLabel?: string | null
    decisionMetadata: Record<string, unknown>
  }
  hyperliquid: {
    dataAsOf: string
    entryPrice: number | null
    markPrice: number | null
    positionValueUsd: number | null
    unrealizedPnlUsd: number | null
    realizedPnlUsd: number | null
    feesUsd: number | null
    netRealizedPnlUsd: number | null
    liquidationPrice: number | null
    fundingRate: number | null
    openInterestUsd: number | null
    volume24hUsd: number | null
    priceChange24hPct: number | null
    evidenceStatus: string
    marketRegime: {
      fine: string
      coarse: string
      confidence: number
      methodologyVersion: string
      missingFields: string[]
    } | null
  }
  lifecycleEvents: Array<{
    eventId: string
    eventType: PositionLifecycleEventType
    occurredAt: string
    evidenceLayer: EvidenceLayer
    payload: Record<string, unknown>
  }>
  priorAnalyses: PriorTradeJournalAnalysis[]
  assembledAt: string
}

export type InverseAkitaTradeJournalEvidence = {
  analysisOnly: true
  lifecycle: InverseAkitaTradeJournalEvidenceInput['lifecycle']
  opinion: {
    roomId: string
    sourceSide: OpinionSide
    inverseSide: OpinionSide
    normalizedMarket: string
    sourceTimestamp: string
  }
  auditSource: {
    decisionId: string
    sourceMessageId: string
    sourceHash: string
  }
  dataAsOf: string
  assembledAt: string
  missingFields: string[]
  items: InverseAkitaTradeJournalEvidenceItem[]
  layers: Record<EvidenceLayer, InverseAkitaTradeJournalEvidenceItem[]>
}

function evidenceId(lifecycleId: string, decisionId: string, key: string, provenance: string): string {
  return `ev_${createHash('sha256')
    .update(`${lifecycleId}|${decisionId}|${key}|${provenance}`)
    .digest('hex')
    .slice(0, 24)}`
}

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, decimals = 6): number {
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

function recordedAuthorAccess(metadata: Record<string, unknown>): RecordedAuthorAccess | null {
  const raw = metadata.authorAccess
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.eligible !== 'boolean') return null
  const reason = String(record.reason ?? '').trim()
  if (!reason || reason.length > 128) return null
  const stakedKeys = record.stakedKeys == null ? null : finite(record.stakedKeys)
  if (record.stakedKeys != null && (stakedKeys == null || stakedKeys < 0)) return null
  return { eligible: record.eligible, reason, stakedKeys }
}

export function assembleInverseAkitaTradeJournalEvidence(
  input: InverseAkitaTradeJournalEvidenceInput,
): InverseAkitaTradeJournalEvidence {
  const items: InverseAkitaTradeJournalEvidenceItem[] = []
  const missing = new Set<string>()
  const add = (
    key: string,
    layer: EvidenceLayer,
    value: unknown,
    provenance: string,
    dataAsOf: string,
    missingKey?: string,
  ) => {
    const unavailable = value == null
    if (unavailable && missingKey) missing.add(missingKey)
    items.push({
      evidenceId: evidenceId(
        input.lifecycle.lifecycleId,
        input.source.decisionId,
        key,
        provenance,
      ),
      key,
      layer,
      availability: unavailable ? 'unavailable' : 'available',
      value: unavailable ? null : value,
      provenance,
      dataAsOf,
    })
  }

  add(
    'position_lifecycle',
    'observed',
    {
      state: input.lifecycle.state,
      market: input.lifecycle.market,
      side: input.lifecycle.side,
      openedAt: input.lifecycle.openedAt,
      closedAt: input.lifecycle.closedAt,
      attributionQuality: input.lifecycle.attributionQuality,
      reconciliationGeneration: input.lifecycle.reconciliationGeneration,
    },
    `lifecycle:${input.lifecycle.lifecycleId}`,
    input.lifecycle.closedAt ?? input.hyperliquid.dataAsOf,
  )
  add(
    'parsed_opinion',
    'observed',
    {
      roomId: input.source.roomId,
      sourceSide: input.source.sourceSide,
      inverseSide: input.source.inverseSide,
      normalizedMarket: input.source.normalizedMarket,
      sourceTimestamp: input.source.sourceTimestamp,
      parseMode: input.source.decisionMetadata.parseMode ?? null,
    },
    `decision:${input.source.decisionId}`,
    input.source.sourceTimestamp,
  )

  const authority = recordedAuthorAccess(input.source.decisionMetadata)
  add(
    'friendkey_authority',
    'observed',
    authority,
    'decision_metadata:author_access',
    input.source.sourceTimestamp,
    'friendkey_authority',
  )

  const hyperliquidFields: Array<[string, unknown]> = [
    ['execution_evidence_status', input.hyperliquid.evidenceStatus],
    ['entry_price', input.hyperliquid.entryPrice],
    ['mark_price', input.hyperliquid.markPrice],
    ['position_value_usd', input.hyperliquid.positionValueUsd],
    ['unrealized_pnl_usd', input.hyperliquid.unrealizedPnlUsd],
    ['liquidation_price', input.hyperliquid.liquidationPrice],
    ['funding_rate', input.hyperliquid.fundingRate],
    ['open_interest_usd', input.hyperliquid.openInterestUsd],
    ['volume_24h_usd', input.hyperliquid.volume24hUsd],
    ['price_change_24h_pct', input.hyperliquid.priceChange24hPct],
  ]
  if (input.lifecycle.state === 'closed') {
    hyperliquidFields.push(
      ['realized_pnl_usd', input.hyperliquid.realizedPnlUsd],
      ['fees_usd', input.hyperliquid.feesUsd],
      ['net_realized_pnl_usd', input.hyperliquid.netRealizedPnlUsd],
    )
  }
  for (const [key, value] of hyperliquidFields) {
    add(
      key,
      'observed',
      value,
      `hyperliquid:${input.hyperliquid.evidenceStatus}`,
      input.hyperliquid.dataAsOf,
      key,
    )
  }
  add(
    'market_regime',
    'derived',
    input.hyperliquid.marketRegime,
    input.hyperliquid.marketRegime
      ? `deterministic:${input.hyperliquid.marketRegime.methodologyVersion}`
      : 'deterministic:market_regime_unavailable',
    input.hyperliquid.dataAsOf,
    'market_regime',
  )
  for (const field of input.hyperliquid.marketRegime?.missingFields ?? []) {
    missing.add(`market_regime:${field}`)
  }

  for (const event of [...input.lifecycleEvents].sort((a, b) => (
    a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId)
  ))) {
    add(
      `lifecycle_event:${event.eventId}`,
      event.evidenceLayer,
      { eventType: event.eventType, payload: event.payload },
      `lifecycle_event:${event.eventId}`,
      event.occurredAt,
    )
  }

  const entry = finite(input.hyperliquid.entryPrice)
  const mark = finite(input.hyperliquid.markPrice)
  add(
    'mark_return_since_entry_pct',
    'derived',
    entry != null && entry !== 0 && mark != null ? round(((mark - entry) / entry) * 100) : null,
    'deterministic:entry_mark_return_v1',
    input.hyperliquid.dataAsOf,
    'mark_return_since_entry_pct',
  )
  const positionValue = finite(input.hyperliquid.positionValueUsd)
  const unrealizedPnl = finite(input.hyperliquid.unrealizedPnlUsd)
  add(
    'unrealized_pnl_on_position_value_pct',
    'derived',
    positionValue != null && positionValue > 0 && unrealizedPnl != null
      ? round((unrealizedPnl / positionValue) * 100)
      : null,
    'deterministic:unrealized_pnl_position_value_v1',
    input.hyperliquid.dataAsOf,
    'unrealized_pnl_on_position_value_pct',
  )
  const volume24h = finite(input.hyperliquid.volume24hUsd)
  add(
    'position_to_volume_bps',
    'derived',
    positionValue != null && volume24h != null && volume24h > 0
      ? round((positionValue / volume24h) * 10_000)
      : null,
    'deterministic:position_to_volume_v1',
    input.hyperliquid.dataAsOf,
    'position_to_volume_bps',
  )
  const terminalTime = input.lifecycle.closedAt ?? input.assembledAt
  const ageHours = (Date.parse(terminalTime) - Date.parse(input.lifecycle.openedAt)) / 3_600_000
  add(
    'position_age_hours',
    'derived',
    Number.isFinite(ageHours) && ageHours >= 0 ? round(ageHours, 3) : null,
    'deterministic:position_age_v1',
    terminalTime,
    'position_age_hours',
  )

  const prior = [...input.priorAnalyses].sort((a, b) => (
    a.createdAt.localeCompare(b.createdAt) || a.analysisId.localeCompare(b.analysisId)
  ))
  if (prior.length === 0) {
    add(
      'prior_thesis',
      'interpretation',
      null,
      'journal_analysis:unavailable',
      input.assembledAt,
      'prior_thesis_history',
    )
  } else {
    for (const analysis of prior) {
      add(
        'prior_thesis',
        'interpretation',
        {
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          interpretation: analysis.interpretation,
        },
        `journal_analysis:${analysis.analysisId}`,
        analysis.createdAt,
      )
    }
  }

  return {
    analysisOnly: true,
    lifecycle: { ...input.lifecycle },
    opinion: {
      roomId: input.source.roomId,
      sourceSide: input.source.sourceSide,
      inverseSide: input.source.inverseSide,
      normalizedMarket: input.source.normalizedMarket,
      sourceTimestamp: input.source.sourceTimestamp,
    },
    auditSource: {
      decisionId: input.source.decisionId,
      sourceMessageId: input.source.sourceMessageId,
      sourceHash: input.source.sourceHash,
    },
    dataAsOf: input.hyperliquid.dataAsOf,
    assembledAt: input.assembledAt,
    missingFields: [...missing].sort(),
    items,
    layers: {
      observed: items.filter((item) => item.layer === 'observed'),
      derived: items.filter((item) => item.layer === 'derived'),
      interpretation: items.filter((item) => item.layer === 'interpretation'),
    },
  }
}
