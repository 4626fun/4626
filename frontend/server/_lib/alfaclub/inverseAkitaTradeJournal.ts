import { createHash, randomUUID } from 'node:crypto'

import {
  analyzeInverseAkitaTradeJournalEvidence,
  fallbackInverseAkitaTradeJournalAnalysis,
  type InverseAkitaTradeJournalAnalysis,
} from './inverseAkitaTradeJournalAnalysis.js'
import {
  assembleInverseAkitaTradeJournalEvidence,
  type InverseAkitaTradeJournalEvidenceInput,
} from './inverseAkitaTradeJournalEvidence.js'
import { registerInverseAkitaBotOutboundText } from './inverseAkitaBotAuthoredText.js'
import {
  beginOpinionTradeJournalRevision,
  claimOpinionTradeJournalDispatch,
  completeOpinionTradeJournalRevision,
  getOpinionTradeJournalDispatch,
  getOpinionTradeJournalPublicAttribution,
  getOpinionTradeJournalSource,
  listOpinionTradeJournalDeliveries,
  listOpinionTradeJournalInfluences,
  listOpinionTradeJournalAnalyses,
  listOpinionTradeJournalDecisions,
  listPositionLifecycleEvents,
  listPositionLifecyclesForJournal,
  markOpinionTradeJournalRevisionSending,
  persistOpinionTradeJournalAnalysis,
  prepareOpinionTradeJournalDeliveries,
  markOpinionTradeJournalDeliverySending,
  recordOpinionTradeJournalDeliveryFailure,
  recordOpinionTradeJournalDeliverySent,
  recoverOpinionTradeJournalRevisionSendUnknown,
  renewOpinionTradeJournalDispatch,
  resolveOpinionTradeJournalRevisionSendUnknown,
  resolveOpinionTradeJournalSendUnknown,
  transitionOpinionTradeJournalDispatch,
  type OpinionTradeJournalDecision,
  type OpinionTradeJournalDispatch,
  type OpinionTradeJournalInfluence,
  type OpinionTradeJournalSource,
  type PositionLifecycle,
  type PositionLifecycleEvent,
} from './inverseOpinionTradeStore.js'
import { isInverseOpinionTradeCaptureEnabled } from './inverseOpinionTradeCaptureConfig.js'
import { sendInverseAkitaJournalTextStrict } from './inverseAkitaTradeJournalSender.js'

declare const process: { env: Record<string, string | undefined> }

export const INVERSE_AKITA_JOURNAL_ROOM_ID = '1659' as const
export const INVERSE_AKITA_JOURNAL_MARKER = '<!-- inverse-akita-trade-journal:v1 -->'
const CABALS_URL = 'https://cabals.com/cabal/inverseakita'
const VIRTUALS_URL = 'https://degen.virtuals.io/agents/1213'
const ROOM_URL = 'https://alfaclub.4626.fun/rooms'
const SCHEDULED_UTC_HOUR = 12
const SCHEDULED_UTC_MINUTE = 10
const WINDOW_MS = 24 * 60 * 60_000
const STALE_EVIDENCE_MS = 2 * 60 * 60_000
const ANALYSIS_CONCURRENCY = 3
const DEFAULT_ANALYSIS_DEADLINE_MS = 45_000
const DISPATCH_LEASE_SECONDS = 300

export type InverseAkitaJournalWindow = { start: string; end: string }

export type InverseAkitaTradeJournalTrade = {
  lifecycleId: string
  state: PositionLifecycle['lifecycleState']
  market: string
  side: PositionLifecycle['side']
  openedAt: string
  closedAt: string | null
  dataAsOf: string
  unrealizedPnlUsd: number | null
  realizedPnlUsd: number | null
  attribution: {
    label: string
    roomId: string
    paraphrase: string
    influences: Array<{
      decisionId: string
      label: string
      roomId: string
      paraphrase: string
      action: PositionLifecycleEvent['eventType']
      occurredAt: string
    }>
  }
  analysis: Pick<
    InverseAkitaTradeJournalAnalysis,
    | 'verdict'
    | 'confidence'
    | 'interpretation'
    | 'invalidationCondition'
    | 'watchCondition'
    | 'closedThesisAssessment'
  >
}

export type InverseAkitaTradeJournalBundle = {
  window: InverseAkitaJournalWindow
  decisions: OpinionTradeJournalDecision[]
  trades: InverseAkitaTradeJournalTrade[]
  generatedAt: string
}

type JournalSourceProjection = OpinionTradeJournalSource & {
  publicAuthorLabel: string | null
  senderAddress: string | null
}

export type InverseAkitaTradeJournalDependencies = {
  claimDispatch: typeof claimOpinionTradeJournalDispatch
  listDecisions: typeof listOpinionTradeJournalDecisions
  listLifecycles: typeof listPositionLifecyclesForJournal
  getSource: (lifecycleId: string) => Promise<JournalSourceProjection | null>
  listInfluences: typeof listOpinionTradeJournalInfluences
  listEvents: typeof listPositionLifecycleEvents
  listAnalyses: typeof listOpinionTradeJournalAnalyses
  analyze: typeof analyzeInverseAkitaTradeJournalEvidence
  persistAnalysis: typeof persistOpinionTradeJournalAnalysis
  prepareDeliveries: typeof prepareOpinionTradeJournalDeliveries
  markDeliverySending: typeof markOpinionTradeJournalDeliverySending
  listDeliveries: typeof listOpinionTradeJournalDeliveries
  recordDeliverySent: typeof recordOpinionTradeJournalDeliverySent
  recordDeliveryFailure: typeof recordOpinionTradeJournalDeliveryFailure
  renewDispatch: typeof renewOpinionTradeJournalDispatch
  markSending: (params: {
    windowStart: string
    windowEnd: string
    claimantToken: string
  }) => Promise<void>
  markSent: (params: {
    windowStart: string
    windowEnd: string
    claimantToken: string
    parentMessageId: string
    contentHash: string
  }) => Promise<void>
  markFailed: (params: {
    windowStart: string
    windowEnd: string
    claimantToken: string
    state: 'failed' | 'send_unknown'
    errorCode: string
  }) => Promise<void>
  sendStrict: typeof sendInverseAkitaJournalTextStrict
  registerBotText: typeof registerInverseAkitaBotOutboundText
  getDispatch?: typeof getOpinionTradeJournalDispatch
  beginRevision?: typeof beginOpinionTradeJournalRevision
  markRevisionSending: typeof markOpinionTradeJournalRevisionSending
  completeRevision?: typeof completeOpinionTradeJournalRevision
  recoverRevisionSendUnknown?: typeof recoverOpinionTradeJournalRevisionSendUnknown
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function readInverseAkitaTradeJournalFlags(): {
  publishEnabled: boolean
  captureEnabled: boolean
} {
  return {
    publishEnabled: boolEnv('ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED', false),
    captureEnabled: isInverseOpinionTradeCaptureEnabled(),
  }
}

export function scheduledInverseAkitaJournalWindow(now = new Date()): InverseAkitaJournalWindow {
  const end = new Date(now)
  end.setUTCSeconds(0, 0)
  end.setUTCHours(SCHEDULED_UTC_HOUR, SCHEDULED_UTC_MINUTE, 0, 0)
  if (now.getTime() < end.getTime()) end.setUTCDate(end.getUTCDate() - 1)
  return {
    start: new Date(end.getTime() - WINDOW_MS).toISOString(),
    end: end.toISOString(),
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableParentClientMessageId(window: InverseAkitaJournalWindow): string {
  return `inverse-akita-journal:${hash(`${INVERSE_AKITA_JOURNAL_ROOM_ID}|${window.start}|${window.end}`).slice(0, 32)}:parent`
}

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(value: unknown, fallback: string): string {
  const parsed = String(value ?? '').trim()
  return parsed || fallback
}

function shortWallet(value: string | null): string {
  const wallet = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(wallet)
    ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
    : 'attribution unavailable'
}

export function sanitizeInverseAkitaPublicLabel(
  label: string | null,
  wallet: string | null,
): string {
  const raw = String(label ?? '')
  const hasControl = /[\u0000-\u001f\u007f-\u009f]/u.test(raw)
  const normalized = raw.replace(/[\u0000-\u001f\u007f-\u009f]/gu, '').replace(/\s+/g, ' ').trim()
  const safeHandle = /^@[A-Za-z0-9_]{1,30}$/.test(normalized)
  const safeDisplayName =
    /^[\p{L}\p{N}][\p{L}\p{N} ._'’\-]{0,63}$/u.test(normalized)
    && !normalized.includes('..')
  const risky =
    hasControl
    || /(?:https?:\/\/|www\.|(?:^|\s)[A-Za-z]:\\)/iu.test(normalized)
    || /[[\]()<>{}`\\/|#:]/u.test(normalized)
  if (!risky && (safeHandle || safeDisplayName)) return normalized
  return shortWallet(wallet)
}

function opinionParaphrase(side: 'long' | 'short', market: string): string {
  return `Expressed a ${side === 'long' ? 'bullish' : 'bearish'} view on ${market}.`
}

function formatUsd(value: number | null): string {
  if (value == null) return 'unavailable'
  const sign = value > 0 ? '+' : ''
  return `${sign}$${value.toFixed(2)}`
}

function reasonGroups(decisions: OpinionTradeJournalDecision[]): string[] {
  const grouped = new Map<string, number>()
  for (const decision of decisions) {
    if (!['rejected', 'blocked', 'failed', 'incomplete'].includes(decision.terminalOutcome ?? '')) continue
    const key = `${decision.terminalOutcome}:${decision.reasonCode ?? 'unspecified'}`
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key.replace(':', ' · ')} ×${count}`)
}

export function formatInverseAkitaTradeJournal(
  bundle: InverseAkitaTradeJournalBundle,
): { parent: string; replies: string[] } {
  const counts = {
    qualified: bundle.decisions.length,
    executed: bundle.decisions.filter((row) => row.terminalOutcome === 'executed').length,
    rejected: bundle.decisions.filter((row) => row.terminalOutcome === 'rejected').length,
    blocked: bundle.decisions.filter((row) => row.terminalOutcome === 'blocked').length,
    failed: bundle.decisions.filter((row) => row.terminalOutcome === 'failed').length,
    executionUnresolved: bundle.decisions.filter((row) => row.terminalOutcome === null).length,
    terminalIncomplete: bundle.decisions.filter((row) => row.terminalOutcome === 'incomplete').length,
    open: bundle.trades.filter((row) => row.state === 'open').length,
    closed: bundle.trades.filter((row) => row.state === 'closed').length,
    pending: bundle.trades.filter((row) => row.state === 'pending').length,
    partial: bundle.trades.filter((row) => row.state === 'partial').length,
    ambiguous: bundle.trades.filter((row) => row.state === 'ambiguous').length,
    incomplete: bundle.trades.filter((row) => row.state === 'incomplete').length,
  }
  if (counts.qualified === 0 && bundle.trades.length === 0) {
    return {
      parent: `${INVERSE_AKITA_JOURNAL_MARKER}\n**InverseAKITA Trade Journal**\nNo qualified opinions or tracked positions in this reporting window.`,
      replies: [],
    }
  }

  const parent = [
    INVERSE_AKITA_JOURNAL_MARKER,
    `**InverseAKITA Trade Journal** · ${bundle.window.start} → ${bundle.window.end}`,
    `qualified ${counts.qualified} · executed ${counts.executed} · rejected ${counts.rejected} · blocked ${counts.blocked} · failed ${counts.failed} · execution unresolved ${counts.executionUnresolved} · terminal incomplete ${counts.terminalIncomplete} · open ${counts.open} · closed ${counts.closed} · pending ${counts.pending} · partial ${counts.partial} · ambiguous ${counts.ambiguous} · incomplete ${counts.incomplete}`,
    reasonGroups(bundle.decisions).length > 0
      ? `Concrete outcomes: ${reasonGroups(bundle.decisions).join(' · ')}`
      : counts.executionUnresolved > 0 || counts.terminalIncomplete > 0
        ? `Concrete outcomes pending: execution unresolved ${counts.executionUnresolved} · terminal incomplete ${counts.terminalIncomplete}.`
        : 'Concrete outcomes: none.',
    ...bundle.trades
      .filter((trade) => Date.parse(bundle.generatedAt) - Date.parse(trade.dataAsOf) > STALE_EVIDENCE_MS)
      .slice(0, 1)
      .map((trade) => `⚠ Hyperliquid evidence is stale · data_as_of ${trade.dataAsOf}; journal still published.`),
    '',
    `AlfaClub is the opinion and room-context record. Hermit4626 analyzes recorded facts; InverseAKITA owns the counter-position strategy. Virtuals ACP executes approved trades (${VIRTUALS_URL}); Hyperliquid is execution and PnL truth.`,
    `Cabals is InverseAKITA's community and wallet-level attribution surface, not the source-opinion lineage: ${CABALS_URL}`,
  ].join('\n')

  const replies = bundle.trades.map((trade) => {
    const stale = bundle.generatedAt
      && Date.parse(bundle.generatedAt) - Date.parse(trade.dataAsOf) > STALE_EVIDENCE_MS
    const pnl = trade.state === 'closed'
      ? `realized PnL ${formatUsd(trade.realizedPnlUsd)}`
      : `unrealized PnL ${formatUsd(trade.unrealizedPnlUsd)}`
    return [
      INVERSE_AKITA_JOURNAL_MARKER,
      `**${trade.market} ${trade.side} · ${trade.state}**`,
      ...(trade.attribution.influences.length > 0
        ? trade.attribution.influences.map((influence) => (
            `${influence.label} · ${influence.paraphrase} · source room ${ROOM_URL}?roomId=${encodeURIComponent(influence.roomId)} · ${influence.action} · ${influence.occurredAt}`
          ))
        : [
            `${trade.attribution.label} · ${trade.attribution.paraphrase} · source room ${ROOM_URL}?roomId=${encodeURIComponent(trade.attribution.roomId)}`,
          ]),
      `${pnl} · opened ${trade.openedAt}${trade.closedAt ? ` · closed ${trade.closedAt}` : ''}`,
      ...(stale ? [`⚠ Hyperliquid evidence is stale · data_as_of ${trade.dataAsOf}`] : []),
      `Hermit4626 analysis only: ${trade.analysis.verdict} (${Math.round(trade.analysis.confidence * 100)}% confidence) — ${trade.analysis.interpretation}`,
      `Invalidation: ${trade.analysis.invalidationCondition}`,
      `Watch: ${trade.analysis.watchCondition}`,
      ...(trade.analysis.closedThesisAssessment
        ? [`Closed thesis: ${trade.analysis.closedThesisAssessment}`]
        : []),
    ].join('\n')
  })
  return { parent, replies }
}

function evidenceInput(params: {
  lifecycle: PositionLifecycle
  source: JournalSourceProjection
  events: PositionLifecycleEvent[]
  analyses: Awaited<ReturnType<typeof listOpinionTradeJournalAnalyses>>
  assembledAt: string
}): InverseAkitaTradeJournalEvidenceInput {
  const current = params.lifecycle.currentSnapshot
  const realized = params.lifecycle.realizedResult
  const dataAsOf = stringValue(
    current.dataAsOf ?? realized.dataAsOf ?? params.lifecycle.lastReconciledAt,
    params.assembledAt,
  )
  return {
    lifecycle: {
      lifecycleId: params.lifecycle.lifecycleId,
      state: params.lifecycle.lifecycleState,
      market: params.lifecycle.normalizedMarket,
      side: params.lifecycle.side,
      openedAt: params.lifecycle.openedAt,
      closedAt: params.lifecycle.closedAt,
      attributionQuality: params.lifecycle.attributionQuality,
      reconciliationGeneration: params.lifecycle.reconciliationGeneration,
    },
    source: {
      decisionId: params.source.decisionId,
      roomId: params.source.roomId,
      sourceMessageId: params.source.sourceMessageId,
      sourceHash: params.source.sourceHash,
      sourceTimestamp: params.source.sourceTimestamp,
      sourceSide: params.source.sourceSide,
      inverseSide: params.source.inverseSide,
      normalizedMarket: params.source.normalizedMarket,
      decisionMetadata: params.source.decisionMetadata,
    },
    hyperliquid: {
      dataAsOf,
      entryPrice: finite(current.entryPrice),
      markPrice: finite(current.markPrice),
      positionValueUsd: finite(current.positionValueUsd),
      unrealizedPnlUsd: finite(current.unrealizedPnlUsd),
      realizedPnlUsd: finite(realized.realizedPnlUsd),
      feesUsd: finite(realized.feesUsd),
      netRealizedPnlUsd: finite(realized.netRealizedPnlUsd),
      liquidationPrice: finite(current.liquidationPrice),
      fundingRate: finite(current.fundingRate),
      openInterestUsd: finite(current.openInterestUsd),
      volume24hUsd: finite(current.volume24hUsd),
      priceChange24hPct: finite(current.priceChange24hPct),
      evidenceStatus: stringValue(current.evidenceStatus, 'unavailable'),
      marketRegime: null,
    },
    lifecycleEvents: params.events.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      evidenceLayer: event.evidenceLayer,
      payload: event.eventPayload,
    })),
    priorAnalyses: params.analyses.map((analysis) => ({
      analysisId: analysis.analysisId,
      createdAt: analysis.createdAt,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      interpretation: stringValue(analysis.interpretation.text, 'Prior analysis recorded.'),
    })),
    assembledAt: params.assembledAt,
  }
}

async function defaultGetSource(lifecycleId: string): Promise<JournalSourceProjection | null> {
  const [source, attribution] = await Promise.all([
    getOpinionTradeJournalSource(lifecycleId),
    getOpinionTradeJournalPublicAttribution(lifecycleId),
  ])
  return source
    ? {
        ...source,
        publicAuthorLabel: attribution?.publicAuthorLabel ?? null,
        senderAddress: attribution?.senderAddress ?? null,
      }
    : null
}

const DEFAULT_DEPS: InverseAkitaTradeJournalDependencies = {
  claimDispatch: claimOpinionTradeJournalDispatch,
  listDecisions: listOpinionTradeJournalDecisions,
  listLifecycles: listPositionLifecyclesForJournal,
  getSource: defaultGetSource,
  listInfluences: listOpinionTradeJournalInfluences,
  listEvents: listPositionLifecycleEvents,
  listAnalyses: listOpinionTradeJournalAnalyses,
  analyze: analyzeInverseAkitaTradeJournalEvidence,
  persistAnalysis: persistOpinionTradeJournalAnalysis,
  prepareDeliveries: prepareOpinionTradeJournalDeliveries,
  markDeliverySending: markOpinionTradeJournalDeliverySending,
  listDeliveries: listOpinionTradeJournalDeliveries,
  recordDeliverySent: recordOpinionTradeJournalDeliverySent,
  recordDeliveryFailure: recordOpinionTradeJournalDeliveryFailure,
  renewDispatch: renewOpinionTradeJournalDispatch,
  markSending: (params) => transitionOpinionTradeJournalDispatch({ ...params, state: 'sending' }),
  markSent: (params) => transitionOpinionTradeJournalDispatch({ ...params, state: 'sent' }),
  markFailed: (params) => transitionOpinionTradeJournalDispatch(params),
  sendStrict: sendInverseAkitaJournalTextStrict,
  registerBotText: registerInverseAkitaBotOutboundText,
  getDispatch: getOpinionTradeJournalDispatch,
  beginRevision: beginOpinionTradeJournalRevision,
  markRevisionSending: markOpinionTradeJournalRevisionSending,
  completeRevision: completeOpinionTradeJournalRevision,
  recoverRevisionSendUnknown: recoverOpinionTradeJournalRevisionSendUnknown,
}

async function buildJournalBundle(
  window: InverseAkitaJournalWindow,
  generatedAt: string,
  deps: InverseAkitaTradeJournalDependencies,
  analysisDeadlineMs = DEFAULT_ANALYSIS_DEADLINE_MS,
): Promise<InverseAkitaTradeJournalBundle> {
  const [decisions, lifecycles] = await Promise.all([
    deps.listDecisions({ windowStart: window.start, windowEnd: window.end }),
    deps.listLifecycles({ windowStart: window.start, windowEnd: window.end }),
  ])
  const trades: Array<InverseAkitaTradeJournalTrade | null> = Array(lifecycles.length).fill(null)
  const analysisDeadlineAt = Date.now() + Math.max(1, analysisDeadlineMs)
  let nextIndex = 0
  const processLifecycle = async (index: number): Promise<void> => {
    const lifecycle = lifecycles[index]!
    const source = await deps.getSource(lifecycle.lifecycleId)
    if (!source) return
    const [events, priorAnalyses, queriedInfluences] = await Promise.all([
      deps.listEvents(lifecycle.lifecycleId),
      deps.listAnalyses(lifecycle.lifecycleId),
      deps.listInfluences(lifecycle.lifecycleId),
    ])
    const evidence = assembleInverseAkitaTradeJournalEvidence(evidenceInput({
      lifecycle,
      source,
      events,
      analyses: priorAnalyses,
      assembledAt: generatedAt,
    }))
    const remainingMs = analysisDeadlineAt - Date.now()
    let analysis: InverseAkitaTradeJournalAnalysis
    if (remainingMs <= 0) {
      analysis = fallbackInverseAkitaTradeJournalAnalysis('request_failed')
    } else {
      let deadlineTimer: ReturnType<typeof setTimeout> | null = null
      analysis = await Promise.race([
        deps.analyze(evidence),
        new Promise<InverseAkitaTradeJournalAnalysis>((resolve) => {
          deadlineTimer = setTimeout(
            () => resolve(fallbackInverseAkitaTradeJournalAnalysis('request_failed')),
            remainingMs,
          )
        }),
      ]).finally(() => {
        if (deadlineTimer) clearTimeout(deadlineTimer)
      })
    }
    await deps.persistAnalysis({
      lifecycleId: lifecycle.lifecycleId,
      reportingWindowStart: window.start,
      reportingWindowEnd: window.end,
      evidenceBundle: evidence as unknown as Record<string, unknown>,
      interpretation: {
        text: analysis.interpretation,
        analysisOnly: true,
      },
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      evidenceRefs: analysis.evidenceRefs,
      invalidationCondition: analysis.invalidationCondition,
      watchCondition: analysis.watchCondition,
      closedThesisAssessment: analysis.closedThesisAssessment,
      modelName: analysis.modelProvenance.agentKey,
      modelVersion: null,
      analysisOnly: true,
      failureReason: analysis.fallbackReason,
    })
    const current = lifecycle.currentSnapshot
    const realized = lifecycle.realizedResult
    const influences: OpinionTradeJournalInfluence[] = queriedInfluences.length > 0
      ? queriedInfluences
      : [{
          decisionId: source.decisionId,
          roomId: source.roomId,
          publicAuthorLabel: source.publicAuthorLabel,
          senderAddress: source.senderAddress,
          sourceSide: source.sourceSide,
          normalizedMarket: source.normalizedMarket,
          action: 'open',
          occurredAt: lifecycle.openedAt,
        }]
    trades[index] = {
      lifecycleId: lifecycle.lifecycleId,
      state: lifecycle.lifecycleState,
      market: lifecycle.normalizedMarket,
      side: lifecycle.side,
      openedAt: lifecycle.openedAt,
      closedAt: lifecycle.closedAt,
      dataAsOf: stringValue(
        current.dataAsOf ?? realized.dataAsOf ?? lifecycle.lastReconciledAt,
        generatedAt,
      ),
      unrealizedPnlUsd: finite(current.unrealizedPnlUsd),
      realizedPnlUsd: finite(realized.netRealizedPnlUsd ?? realized.realizedPnlUsd),
      attribution: {
        label: sanitizeInverseAkitaPublicLabel(source.publicAuthorLabel, source.senderAddress),
        roomId: source.roomId,
        paraphrase: opinionParaphrase(source.sourceSide, source.normalizedMarket),
        influences: influences.map((influence) => ({
          decisionId: influence.decisionId,
          label: sanitizeInverseAkitaPublicLabel(
            influence.publicAuthorLabel,
            influence.senderAddress,
          ),
          roomId: influence.roomId,
          paraphrase: opinionParaphrase(influence.sourceSide, influence.normalizedMarket),
          action: influence.action,
          occurredAt: influence.occurredAt,
        })),
      },
      analysis,
    }
  }
  const workers = Array.from(
    { length: Math.min(ANALYSIS_CONCURRENCY, lifecycles.length) },
    async () => {
      while (nextIndex < lifecycles.length) {
        const index = nextIndex
        nextIndex += 1
        await processLifecycle(index)
      }
    },
  )
  await Promise.all(workers)
  return {
    window,
    decisions,
    trades: trades.filter((trade): trade is InverseAkitaTradeJournalTrade => trade !== null),
    generatedAt,
  }
}

export async function runInverseAkitaTradeJournal(params: {
  now?: Date
  claimantToken?: string
  analysisDeadlineMs?: number
  deps?: InverseAkitaTradeJournalDependencies
} = {}): Promise<{
  sent: boolean
  skippedDuplicate: boolean
  roomId: '1659'
  parentMessageId: string | null
}> {
  const now = params.now ?? new Date()
  const window = scheduledInverseAkitaJournalWindow(now)
  const claimantToken = params.claimantToken ?? randomUUID()
  const deps = params.deps ?? DEFAULT_DEPS
  const claimed = await deps.claimDispatch({
    roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
    windowStart: window.start,
    windowEnd: window.end,
    claimantToken,
    leaseSeconds: DISPATCH_LEASE_SECONDS,
    clientMessageId: stableParentClientMessageId(window),
  })
  if (!claimed.won) {
    return {
      sent: false,
      skippedDuplicate: true,
      roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
      parentMessageId: claimed.dispatch.parentMessageId,
    }
  }
  let deliveries = await deps.listDeliveries({
    windowStart: window.start,
    windowEnd: window.end,
  })
  let formatted: { parent: string; replies: string[] }
  if (deliveries.length > 0) {
    const parents = deliveries.filter((delivery) => delivery.kind === 'parent')
    const replies = deliveries
      .filter((delivery) => delivery.kind === 'reply')
      .sort((a, b) => a.ordinal - b.ordinal)
    if (
      parents.length !== 1
      || replies.some((delivery, index) => delivery.ordinal !== index)
    ) {
      throw new Error('journal_delivery_plan_invalid')
    }
    formatted = {
      parent: parents[0]!.content,
      replies: replies.map((delivery) => delivery.content),
    }
  } else {
    const bundle = await buildJournalBundle(
      window,
      now.toISOString(),
      deps,
      params.analysisDeadlineMs,
    )
    formatted = formatInverseAkitaTradeJournal(bundle)
  }
  deps.registerBotText(formatted.parent)
  for (const reply of formatted.replies) deps.registerBotText(reply)
  const plannedDeliveries = [
    {
      kind: 'parent' as const,
      ordinal: 0,
      clientMessageId: claimed.dispatch.clientMessageId,
      contentHash: hash(formatted.parent),
      content: formatted.parent,
    },
    ...formatted.replies.map((reply, index) => ({
      kind: 'reply' as const,
      ordinal: index,
      clientMessageId: `${claimed.dispatch.clientMessageId}:reply:${index}`,
      contentHash: hash(reply),
      content: reply,
    })),
  ]
  if (deliveries.length === 0) {
    deliveries = await deps.prepareDeliveries({
      windowStart: window.start,
      windowEnd: window.end,
      claimantToken,
      deliveries: plannedDeliveries,
    })
  }
  if (deliveries.length === 0) {
    throw new Error('journal_delivery_plan_missing')
  }
  await deps.markSending({
    windowStart: window.start,
    windowEnd: window.end,
    claimantToken,
  })
  const renewOwnership = () => deps.renewDispatch({
    windowStart: window.start,
    windowEnd: window.end,
    claimantToken,
    leaseSeconds: DISPATCH_LEASE_SECONDS,
  })
  let parentMessageId =
    claimed.dispatch.parentMessageId
    ?? deliveries.find((delivery) => delivery.kind === 'parent' && delivery.state === 'sent')
      ?.messageId
    ?? null
  const failDelivery = async (
    kind: 'parent' | 'reply',
    ordinal: number,
    error: unknown,
    externalSendSucceeded = false,
  ): Promise<never> => {
    const unknown =
      externalSendSucceeded
      || (error as { code?: string })?.code === 'journal_send_unknown'
    await deps.recordDeliveryFailure({
      windowStart: window.start,
      windowEnd: window.end,
      claimantToken,
      kind,
      ordinal,
      state: unknown ? 'send_unknown' : 'failed',
      errorCode: externalSendSucceeded
        ? 'journal_sent_record_unknown'
        : unknown ? 'journal_send_unknown' : 'journal_send_failed',
    })
    throw error
  }
  if (!parentMessageId) {
    await renewOwnership()
    await deps.markDeliverySending({
      windowStart: window.start,
      windowEnd: window.end,
      claimantToken,
      kind: 'parent',
      ordinal: 0,
    })
    let sent: Awaited<ReturnType<typeof sendInverseAkitaJournalTextStrict>>
    try {
      sent = await deps.sendStrict({
        roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
        text: formatted.parent,
        clientMessageId:
          deliveries.find((delivery) => delivery.kind === 'parent')?.clientMessageId
          ?? claimed.dispatch.clientMessageId,
      })
      if (!sent.messageId) {
        throw Object.assign(new Error('journal_send_unknown'), { code: 'journal_send_unknown' })
      }
      parentMessageId = sent.messageId
    } catch (error) {
      return failDelivery('parent', 0, error)
    }
    try {
      await deps.recordDeliverySent({
        windowStart: window.start,
        windowEnd: window.end,
        claimantToken,
        kind: 'parent',
        ordinal: 0,
        messageId: parentMessageId,
      })
    } catch (error) {
      return failDelivery('parent', 0, error, true)
    }
  }
  for (let index = 0; index < formatted.replies.length; index += 1) {
    const delivery = deliveries.find((candidate) => (
      candidate.kind === 'reply' && candidate.ordinal === index
    ))
    if (delivery?.state === 'sent') continue
    await renewOwnership()
    await deps.markDeliverySending({
      windowStart: window.start,
      windowEnd: window.end,
      claimantToken,
      kind: 'reply',
      ordinal: index,
    })
    let sent: Awaited<ReturnType<typeof sendInverseAkitaJournalTextStrict>>
    try {
      sent = await deps.sendStrict({
        roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
        text: formatted.replies[index],
        replyToMessageId: parentMessageId,
        clientMessageId:
          delivery?.clientMessageId
          ?? `${claimed.dispatch.clientMessageId}:reply:${index}`,
      })
      if (!sent.messageId) {
        throw Object.assign(new Error('journal_send_unknown'), { code: 'journal_send_unknown' })
      }
    } catch (error) {
      return failDelivery('reply', index, error)
    }
    try {
      await deps.recordDeliverySent({
        windowStart: window.start,
        windowEnd: window.end,
        claimantToken,
        kind: 'reply',
        ordinal: index,
        messageId: sent.messageId,
      })
    } catch (error) {
      return failDelivery('reply', index, error, true)
    }
  }
  await renewOwnership()
  await deps.markSent({
    windowStart: window.start,
    windowEnd: window.end,
    claimantToken,
    parentMessageId,
    contentHash: hash([formatted.parent, ...formatted.replies].join('\n')),
  })
  return {
    sent: true,
    skippedDuplicate: false,
    roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
    parentMessageId,
  }
}

export async function regenerateInverseAkitaTradeJournal(params: {
  operatorAddress: string
  window: InverseAkitaJournalWindow
  now?: Date
  deps?: InverseAkitaTradeJournalDependencies
}): Promise<{
  sent: true
  roomId: '1659'
  parentMessageId: string
  analysisRevision: number
}> {
  const now = params.now ?? new Date()
  const deps = params.deps ?? DEFAULT_DEPS
  const dispatch = await (deps.getDispatch ?? getOpinionTradeJournalDispatch)({
    windowStart: params.window.start,
    windowEnd: params.window.end,
  })
  if (dispatch?.state !== 'sent' || !dispatch.parentMessageId) {
    throw new Error('journal_parent_missing')
  }
  const beginRevision = deps.beginRevision ?? beginOpinionTradeJournalRevision
  let begun = await beginRevision({
    windowStart: params.window.start,
    windowEnd: params.window.end,
    operatorAddress: params.operatorAddress,
    clientMessageIdPrefix: `${dispatch.clientMessageId}:revision`,
    publicText: null,
  })
  if (!begun) {
    const bundle = await buildJournalBundle(params.window, now.toISOString(), deps)
    const formatted = formatInverseAkitaTradeJournal(bundle)
    const nextRevision = dispatch.analysisRevision + 1
    const revisionBody = [
      INVERSE_AKITA_JOURNAL_MARKER,
      `**Analysis revision ${nextRevision}**`,
      formatted.parent,
      ...formatted.replies,
    ].join('\n\n')
    const revisionText = revisionBody.length <= 2_000
      ? revisionBody
      : `${revisionBody.slice(0, 1_960).trimEnd()}\n\n[revision detail truncated]`
    begun = await beginRevision({
      windowStart: params.window.start,
      windowEnd: params.window.end,
      operatorAddress: params.operatorAddress,
      clientMessageIdPrefix: `${dispatch.clientMessageId}:revision`,
      publicText: revisionText,
      expectedRevision: nextRevision,
    })
    if (!begun) throw new Error('journal_revision_allocation_failed')
  }
  const revisionText = begun.publicText
  deps.registerBotText(revisionText)
  await deps.markRevisionSending({
    windowStart: params.window.start,
    windowEnd: params.window.end,
    revision: begun.revision,
    claimantToken: begun.claimantToken,
  })
  let sent: Awaited<ReturnType<typeof sendInverseAkitaJournalTextStrict>>
  try {
    sent = await deps.sendStrict({
      roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
      text: revisionText,
      replyToMessageId: dispatch.parentMessageId,
      clientMessageId: begun.clientMessageId,
    })
    if (!sent.messageId) {
      throw Object.assign(new Error('journal_send_unknown'), { code: 'journal_send_unknown' })
    }
  } catch (error) {
    const state = (error as { code?: string })?.code === 'journal_send_unknown'
      ? 'send_unknown'
      : 'failed'
    await (deps.completeRevision ?? completeOpinionTradeJournalRevision)({
      windowStart: params.window.start,
      windowEnd: params.window.end,
      revision: begun.revision,
      claimantToken: begun.claimantToken,
      state,
    })
    throw error
  }
  const contentHash = hash(revisionText)
  try {
    await (deps.completeRevision ?? completeOpinionTradeJournalRevision)({
      windowStart: params.window.start,
      windowEnd: params.window.end,
      revision: begun.revision,
      claimantToken: begun.claimantToken,
      state: 'sent',
      replyMessageId: sent.messageId,
      contentHash,
    })
  } catch (error) {
    try {
      await (
        deps.recoverRevisionSendUnknown
        ?? recoverOpinionTradeJournalRevisionSendUnknown
      )({
        windowStart: params.window.start,
        windowEnd: params.window.end,
        revision: begun.revision,
        claimantToken: begun.claimantToken,
        replyMessageId: sent.messageId,
        contentHash,
        errorCode: 'journal_revision_sent_record_unknown',
      })
    } catch {
      // A still-requested revision is also allocation-blocking; preserve the original write error.
    }
    throw error
  }
  return {
    sent: true,
    roomId: INVERSE_AKITA_JOURNAL_ROOM_ID,
    parentMessageId: dispatch.parentMessageId,
    analysisRevision: begun.revision,
  }
}

export async function resolveInverseAkitaTradeJournalSendUnknown(params: {
  operatorAddress: string
  window: InverseAkitaJournalWindow
  target?: 'delivery' | 'revision'
  resolution: 'mark_sent' | 'mark_failed'
  deliveryKind?: 'parent' | 'reply'
  deliveryOrdinal?: number
  revision?: number
  knownMessageId?: string | null
  knownContentHash?: string | null
  note: string
}): Promise<{
  resolved: true
  state: 'sent' | 'failed'
  parentMessageId: string | null
}> {
  const target = params.target ?? 'delivery'
  if (target === 'revision') {
    await resolveOpinionTradeJournalRevisionSendUnknown({
      windowStart: params.window.start,
      windowEnd: params.window.end,
      revision: Number(params.revision),
      operatorAddress: params.operatorAddress,
      resolution: params.resolution,
      knownMessageId: params.knownMessageId,
      knownContentHash: params.knownContentHash,
      note: params.note,
    })
  } else {
    await resolveOpinionTradeJournalSendUnknown({
      windowStart: params.window.start,
      windowEnd: params.window.end,
      operatorAddress: params.operatorAddress,
      resolution: params.resolution,
      deliveryKind: params.deliveryKind as 'parent' | 'reply',
      deliveryOrdinal: Number(params.deliveryOrdinal),
      knownMessageId: params.knownMessageId,
      note: params.note,
    })
  }
  return {
    resolved: true,
    state: target === 'revision' && params.resolution === 'mark_sent' ? 'sent' : 'failed',
    parentMessageId:
      target === 'delivery' && params.resolution === 'mark_sent' && params.deliveryKind === 'parent'
        ? params.knownMessageId ?? null
        : null,
  }
}

export type { OpinionTradeJournalDispatch }
