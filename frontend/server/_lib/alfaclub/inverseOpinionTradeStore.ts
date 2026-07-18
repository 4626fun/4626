import { randomUUID } from 'node:crypto'

import { getDb, runInTransaction, type DbPool } from '../db/postgres.js'
import { ensureAlfaclubInverseOpinionTradeSchema } from '../db/schemaBootstrap.js'
import { logger } from '../infra/logger.js'

export type OpinionSide = 'long' | 'short'
export type DecisionExecutionPhase = 'observed' | 'claimed' | 'submitted' | 'resolved' | 'unknown'
export type DecisionTerminalOutcome = 'executed' | 'rejected' | 'blocked' | 'failed' | 'incomplete'
export type AttributionQuality = 'complete' | 'partial' | 'unknown'
export type PositionLifecycleState = 'pending' | 'partial' | 'open' | 'closed' | 'ambiguous' | 'incomplete'
export type PositionLifecycleEventType = 'open' | 'add' | 'trim' | 'close' | 'reconcile'
export type EvidenceLayer = 'observed' | 'derived' | 'interpretation'
export type AnalysisVerdict = 'hold' | 'add' | 'trim' | 'exit' | 'watch'
export type JournalDispatchState = 'claimed' | 'sending' | 'sent' | 'failed' | 'send_unknown'
export type TerminalReplyDeliveryKind = 'result' | 'receipt'

export type TerminalReplyDecision = {
  decisionId: string
  roomId: string
  sourceMessageId: string
  terminalOutcome: DecisionTerminalOutcome
  reasonCode: string | null
  receiptSummary: Record<string, unknown>
}

export type ClaimedTerminalReplyDelivery = {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  roomId: string
  sourceMessageId: string
  publicText: string
  clientMessageId: string
  claimantToken: string
}

export type TerminalReplyDeliveryBacklog = {
  pending: number
  sending: number
  failed: number
  sendUnknown: number
  lastSuccessAt: string | null
}

export class OpinionTradeStoreError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'OpinionTradeStoreError'
    this.code = code
  }
}

export type OpinionTradeDecision = {
  decisionId: string
  sourceMessageId: string
  intentOrdinal: number
  normalizedMarket: string
  sourceSide: OpinionSide
  inverseSide: OpinionSide
  executionPhase: DecisionExecutionPhase
  terminalOutcome: DecisionTerminalOutcome | null
  reasonCode: string | null
  executorWallet: string | null
  requestedParameters: Record<string, unknown>
  receiptSummary: Record<string, unknown>
  attributionQuality: AttributionQuality
  observedAt: string
  submittedAt: string | null
  resolvedAt: string | null
  updatedAt: string
  executionClaimToken?: string | null
  executionClaimed?: boolean
  executionAttemptCount?: number
  recoveryAttemptCount?: number
  recoveryLastCheckedAt?: string | null
  recoveryDeadlineAt?: string | null
}

export type PositionLifecycle = {
  lifecycleId: string
  executorWallet: string
  normalizedMarket: string
  side: OpinionSide
  openingDecisionId: string
  lifecycleState: PositionLifecycleState
  attributionQuality: AttributionQuality
  reconciliationGeneration: number
  openedAt: string
  closedAt: string | null
  lastReconciledAt: string | null
  currentSnapshot: Record<string, unknown>
  realizedResult: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type PositionLifecycleEvent = {
  eventId: string
  lifecycleId: string
  decisionId: string | null
  eventKey: string
  eventType: PositionLifecycleEventType
  evidenceLayer: EvidenceLayer
  analysisVerdict: AnalysisVerdict | null
  eventPayload: Record<string, unknown>
  occurredAt: string
  createdAt: string
}

export type OpinionTradeJournalSource = {
  lifecycleId: string
  decisionId: string
  roomId: string
  sourceMessageId: string
  sourceHash: string
  sourceTimestamp: string
  sourceSide: OpinionSide
  inverseSide: OpinionSide
  normalizedMarket: string
  decisionMetadata: Record<string, unknown>
}

export type OpinionTradeJournalPublicAttribution = {
  lifecycleId: string
  publicAuthorLabel: string | null
  senderAddress: string | null
}

export type OpinionTradeJournalInfluence = {
  decisionId: string
  roomId: string
  publicAuthorLabel: string | null
  senderAddress: string | null
  sourceSide: OpinionSide
  normalizedMarket: string
  action: PositionLifecycleEventType
  occurredAt: string
}

export type OpinionTradeJournalDelivery = {
  kind: 'parent' | 'reply'
  ordinal: number
  state: 'pending' | 'sending' | 'sent' | 'failed' | 'send_unknown'
  clientMessageId: string
  contentHash: string
  content: string
  messageId: string | null
}

export type ClosedThesisAssessment = 'correct' | 'early' | 'late' | 'invalidated'

export type OpinionTradeJournalAnalysisSnapshot = {
  analysisId: string
  lifecycleId: string
  reportingWindowStart: string
  reportingWindowEnd: string
  evidenceBundle: Record<string, unknown>
  interpretation: Record<string, unknown>
  verdict: AnalysisVerdict
  confidence: number
  evidenceRefs: string[]
  invalidationCondition: string
  watchCondition: string
  closedThesisAssessment: ClosedThesisAssessment | null
  modelName: string
  modelVersion: string | null
  analysisOnly: true
  failureReason: string | null
  createdAt: string
}

export type OpinionTradeJournalDecision = {
  decisionId: string
  executionPhase: DecisionExecutionPhase
  terminalOutcome: DecisionTerminalOutcome | null
  reasonCode: string | null
  normalizedMarket: string
  sourceSide: OpinionSide
  inverseSide: OpinionSide
  roomId: string
  publicAuthorLabel: string | null
  senderAddress: string | null
  sourceTimestamp: string
}

export type OpinionTradeJournalDispatch = {
  dispatchId?: string
  roomId: string
  windowStart: string
  windowEnd: string
  state: JournalDispatchState
  claimantToken: string
  clientMessageId: string
  parentMessageId: string | null
  attemptCount: number
  analysisRevision: number
}

type DecisionRow = {
  decision_id: string
  source_message_id: string
  intent_ordinal: number
  normalized_market: string
  source_side: OpinionSide
  inverse_side: OpinionSide
  execution_phase: DecisionExecutionPhase
  terminal_outcome: DecisionTerminalOutcome | null
  reason_code: string | null
  executor_wallet: string | null
  requested_parameters: Record<string, unknown> | null
  receipt_summary: Record<string, unknown> | null
  attribution_quality: AttributionQuality
  observed_at: string
  submitted_at: string | null
  resolved_at: string | null
  updated_at: string
  execution_claim_token?: string | null
  execution_claim_expires_at?: string | null
  execution_attempt_count?: number
  recovery_attempt_count?: number
  recovery_last_checked_at?: string | null
  recovery_deadline_at?: string | null
  execution_claimed?: boolean
}

type LifecycleRow = {
  lifecycle_id: string
  executor_wallet: string
  normalized_market: string
  side: OpinionSide
  opening_decision_id: string
  lifecycle_state: PositionLifecycleState
  attribution_quality: AttributionQuality
  reconciliation_generation: number
  opened_at: string
  closed_at: string | null
  last_reconciled_at: string | null
  current_snapshot: Record<string, unknown> | null
  realized_result: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type LifecycleEventRow = {
  event_id: string
  lifecycle_id: string
  decision_id: string | null
  event_key: string
  event_type: PositionLifecycleEventType
  evidence_layer: EvidenceLayer
  analysis_verdict: AnalysisVerdict | null
  event_payload: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

type JournalSourceRow = {
  lifecycle_id: string
  decision_id: string
  room_id: string
  source_message_id: string
  source_hash: string
  source_timestamp: string
  source_side: OpinionSide
  inverse_side: OpinionSide
  normalized_market: string
  decision_metadata: Record<string, unknown> | null
}

type JournalAnalysisRow = {
  analysis_id: string
  lifecycle_id: string
  reporting_window_start: string
  reporting_window_end: string
  evidence_bundle: Record<string, unknown> | null
  interpretation: Record<string, unknown> | null
  verdict: AnalysisVerdict
  confidence: number
  evidence_refs: unknown
  invalidation_condition: string
  watch_condition: string
  closed_thesis_assessment: ClosedThesisAssessment | null
  model_name: string
  model_version: string | null
  analysis_only: boolean
  failure_reason: string | null
  created_at: string
}

type JournalDecisionRow = {
  decision_id: string
  execution_phase: DecisionExecutionPhase
  terminal_outcome: DecisionTerminalOutcome | null
  reason_code: string | null
  normalized_market: string
  source_side: OpinionSide
  inverse_side: OpinionSide
  room_id: string
  public_author_label: string | null
  sender_address: string | null
  source_timestamp: string
}

type JournalDispatchRow = {
  dispatch_id: string
  room_id: string
  reporting_window_start: string
  reporting_window_end: string
  dispatch_state: JournalDispatchState
  claimant_token: string
  client_message_id: string
  parent_message_id: string | null
  attempt_count: number
  analysis_revision: number
}

type JournalInfluenceRow = {
  decision_id: string
  room_id: string
  public_author_label: string | null
  sender_address: string | null
  source_side: OpinionSide
  normalized_market: string
  action: PositionLifecycleEventType
  occurred_at: string
}

type JournalDeliveryRow = {
  delivery_kind: 'parent' | 'reply'
  delivery_ordinal: number
  delivery_state: OpinionTradeJournalDelivery['state']
  client_message_id: string
  content_hash: string
  public_text: string | null
  message_id: string | null
}

function objectValue(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function mapDecision(row: DecisionRow): OpinionTradeDecision {
  return {
    decisionId: row.decision_id,
    sourceMessageId: row.source_message_id,
    intentOrdinal: Number(row.intent_ordinal),
    normalizedMarket: row.normalized_market,
    sourceSide: row.source_side,
    inverseSide: row.inverse_side,
    executionPhase: row.execution_phase,
    terminalOutcome: row.terminal_outcome,
    reasonCode: row.reason_code,
    executorWallet: row.executor_wallet,
    requestedParameters: objectValue(row.requested_parameters),
    receiptSummary: objectValue(row.receipt_summary),
    attributionQuality: row.attribution_quality,
    observedAt: row.observed_at,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
    updatedAt: row.updated_at,
    executionClaimToken: row.execution_claim_token ?? null,
    executionClaimed: Boolean(row.execution_claimed),
    executionAttemptCount: Number(row.execution_attempt_count ?? 0),
    recoveryAttemptCount: Number(row.recovery_attempt_count ?? 0),
    recoveryLastCheckedAt: row.recovery_last_checked_at ?? null,
    recoveryDeadlineAt: row.recovery_deadline_at ?? null,
  }
}

function mapLifecycle(row: LifecycleRow): PositionLifecycle {
  return {
    lifecycleId: row.lifecycle_id,
    executorWallet: row.executor_wallet,
    normalizedMarket: row.normalized_market,
    side: row.side,
    openingDecisionId: row.opening_decision_id,
    lifecycleState: row.lifecycle_state,
    attributionQuality: row.attribution_quality,
    reconciliationGeneration: Number(row.reconciliation_generation),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    lastReconciledAt: row.last_reconciled_at,
    currentSnapshot: objectValue(row.current_snapshot),
    realizedResult: objectValue(row.realized_result),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapLifecycleEvent(row: LifecycleEventRow): PositionLifecycleEvent {
  return {
    eventId: row.event_id,
    lifecycleId: row.lifecycle_id,
    decisionId: row.decision_id,
    eventKey: row.event_key,
    eventType: row.event_type,
    evidenceLayer: row.evidence_layer,
    analysisVerdict: row.analysis_verdict,
    eventPayload: objectValue(row.event_payload),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

function mapJournalSource(row: JournalSourceRow): OpinionTradeJournalSource {
  return {
    lifecycleId: row.lifecycle_id,
    decisionId: row.decision_id,
    roomId: row.room_id,
    sourceMessageId: row.source_message_id,
    sourceHash: row.source_hash,
    sourceTimestamp: row.source_timestamp,
    sourceSide: row.source_side,
    inverseSide: row.inverse_side,
    normalizedMarket: row.normalized_market,
    decisionMetadata: objectValue(row.decision_metadata),
  }
}

function mapJournalAnalysis(row: JournalAnalysisRow): OpinionTradeJournalAnalysisSnapshot {
  if (row.analysis_only !== true) {
    throw new OpinionTradeStoreError('invalid_analysis_record')
  }
  const evidenceRefs = Array.isArray(row.evidence_refs)
    ? row.evidence_refs.filter((value): value is string => typeof value === 'string')
    : []
  return {
    analysisId: row.analysis_id,
    lifecycleId: row.lifecycle_id,
    reportingWindowStart: row.reporting_window_start,
    reportingWindowEnd: row.reporting_window_end,
    evidenceBundle: objectValue(row.evidence_bundle),
    interpretation: objectValue(row.interpretation),
    verdict: row.verdict,
    confidence: Number(row.confidence),
    evidenceRefs,
    invalidationCondition: row.invalidation_condition,
    watchCondition: row.watch_condition,
    closedThesisAssessment: row.closed_thesis_assessment,
    modelName: row.model_name,
    modelVersion: row.model_version,
    analysisOnly: true,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  }
}

function mapJournalDecision(row: JournalDecisionRow): OpinionTradeJournalDecision {
  return {
    decisionId: row.decision_id,
    executionPhase: row.execution_phase,
    terminalOutcome: row.terminal_outcome,
    reasonCode: row.reason_code,
    normalizedMarket: row.normalized_market,
    sourceSide: row.source_side,
    inverseSide: row.inverse_side,
    roomId: row.room_id,
    publicAuthorLabel: row.public_author_label,
    senderAddress: row.sender_address,
    sourceTimestamp: row.source_timestamp,
  }
}

function mapJournalDispatch(row: JournalDispatchRow): OpinionTradeJournalDispatch {
  return {
    dispatchId: row.dispatch_id,
    roomId: row.room_id,
    windowStart: row.reporting_window_start,
    windowEnd: row.reporting_window_end,
    state: row.dispatch_state,
    claimantToken: row.claimant_token,
    clientMessageId: row.client_message_id,
    parentMessageId: row.parent_message_id,
    attemptCount: Number(row.attempt_count),
    analysisRevision: Number(row.analysis_revision),
  }
}

function mapJournalInfluence(row: JournalInfluenceRow): OpinionTradeJournalInfluence {
  return {
    decisionId: row.decision_id,
    roomId: row.room_id,
    publicAuthorLabel: row.public_author_label,
    senderAddress: row.sender_address,
    sourceSide: row.source_side,
    normalizedMarket: row.normalized_market,
    action: row.action,
    occurredAt: row.occurred_at,
  }
}

function mapJournalDelivery(row: JournalDeliveryRow): OpinionTradeJournalDelivery {
  if (!row.public_text) throw new OpinionTradeStoreError('delivery_text_missing')
  return {
    kind: row.delivery_kind,
    ordinal: Number(row.delivery_ordinal),
    state: row.delivery_state,
    clientMessageId: row.client_message_id,
    contentHash: row.content_hash,
    content: row.public_text,
    messageId: row.message_id,
  }
}

function normalizeMarket(value: string): string | null {
  const market = String(value ?? '').trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(market) ? market : null
}

function normalizeWallet(value: string | null | undefined): string | null {
  const wallet = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : null
}

function requiredText(value: string, maxLength: number): string | null {
  const text = String(value ?? '').trim()
  return text && text.length <= maxLength ? text : null
}

function validIsoTimestamp(value: string): string | null {
  const timestamp = String(value ?? '').trim()
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null
}

function safeDbFingerprint(error: unknown): Record<string, string | undefined> {
  const value = error as Record<string, unknown> | null | undefined
  return {
    code: typeof value?.code === 'string' ? value.code.slice(0, 16) : undefined,
    constraint:
      typeof value?.constraint === 'string' ? value.constraint.slice(0, 128) : undefined,
    routine: typeof value?.routine === 'string' ? value.routine.slice(0, 64) : undefined,
  }
}

function storeFailure(operation: string, error: unknown, code = 'db_write_failed'): OpinionTradeStoreError {
  logger.error('inverse_opinion_trade_store.db_failure', {
    operation,
    ...safeDbFingerprint(error),
  })
  return new OpinionTradeStoreError(code)
}

async function getReadyDb(): Promise<DbPool> {
  const db = await getDb()
  if (!db) throw new OpinionTradeStoreError('db_unavailable')
  try {
    await ensureAlfaclubInverseOpinionTradeSchema(db)
  } catch (error) {
    throw storeFailure('ensure_schema', error, 'schema_unavailable')
  }
  return db
}

export function isLegalDecisionTransition(
  from: DecisionExecutionPhase,
  to: DecisionExecutionPhase,
  outcome: DecisionTerminalOutcome | null,
): boolean {
  if (from === to) return to === 'resolved' ? outcome !== null : false
  if (from === 'observed') return to === 'claimed' && outcome === null
  if (from === 'claimed') {
    return (
      (to === 'submitted' && outcome === null)
      || (to === 'resolved' && (outcome === 'rejected' || outcome === 'blocked'))
    )
  }
  if (from === 'submitted') {
    return (
      (to === 'unknown' && outcome === null)
      || (to === 'resolved' && (outcome === 'executed' || outcome === 'failed'))
    )
  }
  if (from === 'unknown') {
    return (
      to === 'resolved'
      && (outcome === 'executed' || outcome === 'failed' || outcome === 'incomplete')
    )
  }
  return false
}

export function isLegalLifecycleTransition(
  from: PositionLifecycleState,
  to: PositionLifecycleState,
): boolean {
  if (from === to) return true
  if (from === 'pending') return to === 'partial' || to === 'open' || to === 'incomplete'
  if (from === 'partial') return to === 'open' || to === 'ambiguous' || to === 'incomplete'
  if (from === 'open') return to === 'closed'
  if (from === 'ambiguous') return to === 'incomplete'
  return false
}

function isValidTransitionTarget(
  phase: DecisionExecutionPhase,
  outcome: DecisionTerminalOutcome | null,
): boolean {
  return phase === 'resolved' ? outcome !== null : outcome === null
}

export async function claimOpinionIntent(params: {
  source: {
    roomId: string
    messageId: string
    sourceHash: string
    excerpt: string
    senderAddress?: string | null
    publicAuthorLabel?: string | null
    sourceTimestamp: string
  }
  intent: {
    ordinal: number
    normalizedMarket: string
    sourceSide: OpinionSide
    inverseSide: OpinionSide
    attributionQuality: AttributionQuality
  }
}): Promise<OpinionTradeDecision> {
  const roomId = requiredText(params.source.roomId, 128)
  const messageId = requiredText(params.source.messageId, 256)
  const sourceHash = String(params.source.sourceHash ?? '').trim().toLowerCase()
  const excerpt = String(params.source.excerpt ?? '').trim().slice(0, 500)
  const senderAddress =
    params.source.senderAddress == null ? null : normalizeWallet(params.source.senderAddress)
  const publicAuthorLabel =
    params.source.publicAuthorLabel == null
      ? null
      : requiredText(params.source.publicAuthorLabel, 120)
  const sourceTimestamp = validIsoTimestamp(params.source.sourceTimestamp)
  const normalizedMarket = normalizeMarket(params.intent.normalizedMarket)
  const ordinal = Number(params.intent.ordinal)

  if (
    !roomId
    || !messageId
    || !/^[a-f0-9]{64}$/.test(sourceHash)
    || !excerpt
    || (params.source.senderAddress != null && !senderAddress)
    || (params.source.publicAuthorLabel != null && !publicAuthorLabel)
    || !sourceTimestamp
    || !normalizedMarket
    || !Number.isInteger(ordinal)
    || ordinal < 0
    || ordinal > 31
    || params.intent.sourceSide === params.intent.inverseSide
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const executionClaimToken = randomUUID()
  const executionLeaseSeconds = 300
  const db = await getReadyDb()
  try {
    const result = await db.sql<DecisionRow>`
      WITH source_message AS (
        INSERT INTO alfaclub.inverse_opinion_source_messages (
          room_id,
          message_id,
          source_hash,
          source_excerpt,
          sender_address,
          public_author_label,
          source_timestamp,
          observed_at
        ) VALUES (
          ${roomId},
          ${messageId},
          ${sourceHash},
          ${excerpt},
          ${senderAddress},
          ${publicAuthorLabel},
          ${sourceTimestamp}::timestamptz,
          NOW()
        )
        ON CONFLICT (room_id, message_id) DO UPDATE
        SET room_id = EXCLUDED.room_id
        RETURNING source_message_id, source_timestamp
      )
      INSERT INTO alfaclub.inverse_opinion_trade_decisions (
        source_message_id,
        intent_ordinal,
        normalized_market,
        source_side,
        inverse_side,
        execution_phase,
        terminal_outcome,
        attribution_quality,
        execution_claim_token,
        execution_claim_expires_at,
        execution_attempt_count,
        observed_at,
        updated_at
      )
      SELECT
        source_message_id,
        ${ordinal},
        ${normalizedMarket},
        ${params.intent.sourceSide},
        ${params.intent.inverseSide},
        'claimed',
        NULL,
        ${params.intent.attributionQuality},
        ${executionClaimToken}::uuid,
        NOW() + (${executionLeaseSeconds} * INTERVAL '1 second'),
        1,
        source_timestamp,
        NOW()
      FROM source_message
      ON CONFLICT (source_message_id, intent_ordinal, normalized_market) DO UPDATE
      SET execution_claim_token = EXCLUDED.execution_claim_token,
          execution_claim_expires_at = EXCLUDED.execution_claim_expires_at,
          execution_attempt_count =
            alfaclub.inverse_opinion_trade_decisions.execution_attempt_count + 1,
          updated_at = NOW()
      WHERE alfaclub.inverse_opinion_trade_decisions.execution_phase = 'claimed'
        AND alfaclub.inverse_opinion_trade_decisions.execution_claim_expires_at <= NOW()
      RETURNING
        decision_id,
        source_message_id,
        intent_ordinal,
        normalized_market,
        source_side,
        inverse_side,
        execution_phase,
        terminal_outcome,
        reason_code,
        executor_wallet,
        requested_parameters,
        receipt_summary,
        attribution_quality,
        observed_at::text AS observed_at,
        submitted_at::text AS submitted_at,
        resolved_at::text AS resolved_at,
        updated_at::text AS updated_at,
        execution_claim_token::text AS execution_claim_token,
        execution_claim_expires_at::text AS execution_claim_expires_at,
        execution_attempt_count,
        recovery_attempt_count,
        recovery_last_checked_at::text AS recovery_last_checked_at,
        recovery_deadline_at::text AS recovery_deadline_at,
        execution_claim_token = ${executionClaimToken}::uuid AS execution_claimed;
    `
    let row = result.rows?.[0]
    if (!row) {
      const existing = await db.sql<DecisionRow>`
        SELECT
          decision_id,
          source_message_id,
          intent_ordinal,
          normalized_market,
          source_side,
          inverse_side,
          execution_phase,
          terminal_outcome,
          reason_code,
          executor_wallet,
          requested_parameters,
          receipt_summary,
          attribution_quality,
          observed_at::text AS observed_at,
          submitted_at::text AS submitted_at,
          resolved_at::text AS resolved_at,
          updated_at::text AS updated_at,
          NULL::text AS execution_claim_token,
          execution_attempt_count,
          recovery_attempt_count,
          recovery_last_checked_at::text AS recovery_last_checked_at,
          recovery_deadline_at::text AS recovery_deadline_at,
          FALSE AS execution_claimed
        FROM alfaclub.inverse_opinion_trade_decisions
        WHERE source_message_id = (
          SELECT source_message_id
          FROM alfaclub.inverse_opinion_source_messages
          WHERE room_id = ${roomId} AND message_id = ${messageId}
        )
          AND intent_ordinal = ${ordinal}
          AND normalized_market = ${normalizedMarket}
        LIMIT 1;
      `
      row = existing.rows?.[0]
    }
    if (!row) throw new OpinionTradeStoreError('claim_failed')
    return mapDecision(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('claim_intent', error)
  }
}

export async function transitionOpinionDecision(params: {
  decisionId: string
  executionPhase: DecisionExecutionPhase
  terminalOutcome?: DecisionTerminalOutcome | null
  reasonCode?: string | null
  executorWallet?: string | null
  executionClaimToken?: string | null
  requestedParameters?: Record<string, unknown>
  receiptSummary?: Record<string, unknown>
}): Promise<OpinionTradeDecision> {
  const decisionId = requiredText(params.decisionId, 64)
  const terminalOutcome = params.terminalOutcome ?? null
  const executorWallet =
    params.executorWallet == null ? null : normalizeWallet(params.executorWallet)
  const reasonCode =
    params.reasonCode == null ? null : requiredText(params.reasonCode, 128)
  const executionClaimToken =
    params.executionClaimToken == null ? null : requiredText(params.executionClaimToken, 64)
  const requiresClaimToken =
    params.executionPhase === 'submitted'
    || (
      params.executionPhase === 'resolved'
      && (terminalOutcome === 'rejected' || terminalOutcome === 'blocked')
    )
  if (
    !decisionId
    || !isValidTransitionTarget(params.executionPhase, terminalOutcome)
    || (params.executorWallet != null && !executorWallet)
    || (params.reasonCode != null && !reasonCode)
    || (requiresClaimToken && !/^[a-f0-9-]{36}$/i.test(executionClaimToken ?? ''))
  ) {
    throw new OpinionTradeStoreError('invalid_transition')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<DecisionRow>`
      UPDATE alfaclub.inverse_opinion_trade_decisions
      SET execution_phase = ${params.executionPhase}::text,
          terminal_outcome = ${terminalOutcome}::text,
          reason_code = ${reasonCode}::text,
          executor_wallet = COALESCE(${executorWallet}::text, executor_wallet),
          requested_parameters = COALESCE(
            ${params.requestedParameters == null ? null : JSON.stringify(params.requestedParameters)}::jsonb,
            requested_parameters
          ),
          receipt_summary = CASE
            WHEN execution_phase = 'resolved' THEN receipt_summary
            ELSE COALESCE(
              ${params.receiptSummary == null ? null : JSON.stringify(params.receiptSummary)}::jsonb,
              receipt_summary
            )
          END,
          execution_claim_token = CASE
            WHEN execution_phase = 'claimed' THEN NULL
            ELSE execution_claim_token
          END,
          execution_claim_expires_at = CASE
            WHEN execution_phase = 'claimed' THEN NULL
            ELSE execution_claim_expires_at
          END,
          submitted_at = CASE
            WHEN ${params.executionPhase}::text = 'submitted' THEN COALESCE(submitted_at, NOW())
            ELSE submitted_at
          END,
          recovery_deadline_at = CASE
            WHEN ${params.executionPhase}::text IN ('submitted', 'unknown')
              THEN COALESCE(recovery_deadline_at, NOW() + INTERVAL '15 minutes')
            ELSE recovery_deadline_at
          END,
          resolved_at = CASE
            WHEN ${params.executionPhase}::text = 'resolved' THEN COALESCE(resolved_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
      WHERE decision_id = ${decisionId}::uuid
        AND (
          (execution_phase = 'resolved'
            AND ${params.executionPhase}::text = 'resolved'
            AND terminal_outcome IS NOT DISTINCT FROM ${terminalOutcome}::text)
          OR (execution_phase = 'observed' AND ${params.executionPhase}::text = 'claimed' AND ${terminalOutcome}::text IS NULL)
          OR (
            execution_phase = 'claimed'
            AND execution_claim_token = ${executionClaimToken}::uuid
            AND execution_claim_expires_at > NOW()
            AND ${params.executionPhase}::text = 'submitted'
            AND ${terminalOutcome}::text IS NULL
          )
          OR (
            execution_phase = 'claimed'
            AND execution_claim_token = ${executionClaimToken}::uuid
            AND execution_claim_expires_at > NOW()
            AND ${params.executionPhase}::text = 'resolved'
            AND ${terminalOutcome}::text IN ('rejected', 'blocked')
          )
          OR (
            execution_phase = 'submitted'
            AND ${params.executionPhase}::text = 'resolved'
            AND ${terminalOutcome}::text IN ('executed', 'failed')
          )
          OR (execution_phase = 'submitted' AND ${params.executionPhase}::text = 'unknown' AND ${terminalOutcome}::text IS NULL)
          OR (
            execution_phase = 'unknown'
            AND ${params.executionPhase}::text = 'resolved'
            AND ${terminalOutcome}::text IN ('executed', 'failed', 'incomplete')
          )
        )
      RETURNING
        decision_id,
        source_message_id,
        intent_ordinal,
        normalized_market,
        source_side,
        inverse_side,
        execution_phase,
        terminal_outcome,
        reason_code,
        executor_wallet,
        requested_parameters,
        receipt_summary,
        attribution_quality,
        observed_at::text AS observed_at,
        submitted_at::text AS submitted_at,
        resolved_at::text AS resolved_at,
        updated_at::text AS updated_at,
        execution_claim_token::text AS execution_claim_token,
        execution_claim_expires_at::text AS execution_claim_expires_at,
        execution_attempt_count,
        recovery_attempt_count,
        recovery_last_checked_at::text AS recovery_last_checked_at,
        recovery_deadline_at::text AS recovery_deadline_at,
        FALSE AS execution_claimed;
    `
    const row = result.rows?.[0]
    if (!row) throw new OpinionTradeStoreError('invalid_transition')
    return mapDecision(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('transition_decision', error)
  }
}

export async function openPositionLifecycle(params: {
  openingDecisionId: string
  executorWallet: string
  normalizedMarket: string
  side: OpinionSide
  lifecycleState?: PositionLifecycleState
  attributionQuality: AttributionQuality
  openedAt?: string
  currentSnapshot?: Record<string, unknown>
}): Promise<PositionLifecycle> {
  const openingDecisionId = requiredText(params.openingDecisionId, 64)
  const executorWallet = normalizeWallet(params.executorWallet)
  const normalizedMarket = normalizeMarket(params.normalizedMarket)
  const lifecycleState = params.lifecycleState ?? 'pending'
  const openedAt = params.openedAt == null ? null : validIsoTimestamp(params.openedAt)
  if (
    !openingDecisionId
    || !executorWallet
    || !normalizedMarket
    || lifecycleState === 'closed'
    || lifecycleState === 'incomplete'
    || (params.openedAt != null && !openedAt)
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleRow>`
      INSERT INTO alfaclub.inverse_position_lifecycles (
        executor_wallet,
        normalized_market,
        side,
        opening_decision_id,
        lifecycle_state,
        attribution_quality,
        current_snapshot,
        opened_at,
        created_at,
        updated_at
      ) VALUES (
        ${executorWallet},
        ${normalizedMarket},
        ${params.side},
        ${openingDecisionId}::uuid,
        ${lifecycleState},
        ${params.attributionQuality},
        ${JSON.stringify(params.currentSnapshot ?? {})}::jsonb,
        COALESCE(${openedAt}::timestamptz, NOW()),
        NOW(),
        NOW()
      )
      RETURNING
        lifecycle_id,
        executor_wallet,
        normalized_market,
        side,
        opening_decision_id,
        lifecycle_state,
        attribution_quality,
        reconciliation_generation,
        opened_at::text AS opened_at,
        closed_at::text AS closed_at,
        last_reconciled_at::text AS last_reconciled_at,
        current_snapshot,
        realized_result,
        created_at::text AS created_at,
        updated_at::text AS updated_at;
    `
    const row = result.rows?.[0]
    if (!row) throw new OpinionTradeStoreError('open_lifecycle_failed')
    return mapLifecycle(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    const fingerprint = safeDbFingerprint(error)
    const conflict =
      fingerprint.code === '23505'
      && fingerprint.constraint === 'inverse_position_lifecycles_one_open_idx'
    throw storeFailure(
      'open_lifecycle',
      error,
      conflict ? 'open_lifecycle_conflict' : 'db_write_failed',
    )
  }
}

export async function appendPositionLifecycleEvent(params: {
  lifecycleId: string
  decisionId?: string | null
  eventKey: string
  eventType: PositionLifecycleEventType
  evidenceLayer: EvidenceLayer
  analysisVerdict?: AnalysisVerdict | null
  eventPayload?: Record<string, unknown>
  occurredAt: string
}): Promise<PositionLifecycleEvent> {
  const lifecycleId = requiredText(params.lifecycleId, 64)
  const decisionId =
    params.decisionId == null ? null : requiredText(params.decisionId, 64)
  const eventKey = requiredText(params.eventKey, 160)
  const occurredAt = validIsoTimestamp(params.occurredAt)
  if (
    !lifecycleId
    || (params.decisionId != null && !decisionId)
    || !eventKey
    || !occurredAt
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleEventRow>`
      INSERT INTO alfaclub.inverse_position_lifecycle_events (
        lifecycle_id,
        decision_id,
        event_key,
        event_type,
        evidence_layer,
        analysis_verdict,
        event_payload,
        occurred_at
      ) VALUES (
        ${lifecycleId}::uuid,
        ${decisionId}::uuid,
        ${eventKey},
        ${params.eventType},
        ${params.evidenceLayer},
        ${params.analysisVerdict ?? null},
        ${JSON.stringify(params.eventPayload ?? {})}::jsonb,
        ${occurredAt}::timestamptz
      )
      ON CONFLICT (lifecycle_id, event_key) DO UPDATE
      SET event_id = alfaclub.inverse_position_lifecycle_events.event_id
      RETURNING
        event_id,
        lifecycle_id,
        decision_id,
        event_key,
        event_type,
        evidence_layer,
        analysis_verdict,
        event_payload,
        occurred_at::text AS occurred_at,
        created_at::text AS created_at;
    `
    const row = result.rows?.[0]
    if (!row) throw new OpinionTradeStoreError('event_append_failed')
    return mapLifecycleEvent(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('append_lifecycle_event', error)
  }
}

export async function transitionPositionLifecycle(params: {
  lifecycleId: string
  lifecycleState: PositionLifecycleState
  attributionQuality?: AttributionQuality
  expectedReconciliationGeneration: number
  currentSnapshot?: Record<string, unknown>
  realizedResult?: Record<string, unknown>
  reconciledAt: string
  closedAt?: string | null
}): Promise<PositionLifecycle> {
  const lifecycleId = requiredText(params.lifecycleId, 64)
  const expectedReconciliationGeneration = Number(params.expectedReconciliationGeneration)
  const reconciledAt = validIsoTimestamp(params.reconciledAt)
  const closedAt = params.closedAt == null ? null : validIsoTimestamp(params.closedAt)
  const terminal = params.lifecycleState === 'closed'
  if (
    !lifecycleId
    || !Number.isInteger(expectedReconciliationGeneration)
    || expectedReconciliationGeneration < 0
    || !reconciledAt
    || (params.closedAt != null && !closedAt)
    || terminal !== Boolean(closedAt)
  ) {
    throw new OpinionTradeStoreError('invalid_transition')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleRow>`
      UPDATE alfaclub.inverse_position_lifecycles
      SET lifecycle_state = ${params.lifecycleState},
          attribution_quality = CASE
            WHEN attribution_quality = 'complete' THEN 'complete'
            WHEN attribution_quality = 'partial' AND ${params.attributionQuality ?? null} = 'unknown'
              THEN 'partial'
            ELSE COALESCE(${params.attributionQuality ?? null}, attribution_quality)
          END,
          reconciliation_generation = reconciliation_generation + 1,
          current_snapshot = COALESCE(
            ${params.currentSnapshot == null ? null : JSON.stringify(params.currentSnapshot)}::jsonb,
            current_snapshot
          ),
          realized_result = COALESCE(
            ${params.realizedResult == null ? null : JSON.stringify(params.realizedResult)}::jsonb,
            realized_result
          ),
          last_reconciled_at = ${reconciledAt}::timestamptz,
          closed_at = ${closedAt}::timestamptz,
          updated_at = NOW()
      WHERE lifecycle_id = ${lifecycleId}::uuid
        AND reconciliation_generation = ${expectedReconciliationGeneration}
        AND (
          lifecycle_state = ${params.lifecycleState}
          OR (lifecycle_state = 'pending' AND ${params.lifecycleState} IN ('partial', 'open'))
          OR (lifecycle_state = 'pending' AND ${params.lifecycleState} = 'incomplete')
          OR (lifecycle_state = 'partial' AND ${params.lifecycleState} IN ('open', 'ambiguous', 'incomplete'))
          OR (lifecycle_state = 'open' AND ${params.lifecycleState} = 'closed')
          OR (lifecycle_state = 'ambiguous' AND ${params.lifecycleState} = 'incomplete')
        )
      RETURNING
        lifecycle_id,
        executor_wallet,
        normalized_market,
        side,
        opening_decision_id,
        lifecycle_state,
        attribution_quality,
        reconciliation_generation,
        opened_at::text AS opened_at,
        closed_at::text AS closed_at,
        last_reconciled_at::text AS last_reconciled_at,
        current_snapshot,
        realized_result,
        created_at::text AS created_at,
        updated_at::text AS updated_at;
    `
    const row = result.rows?.[0]
    if (!row) throw new OpinionTradeStoreError('reconciliation_conflict')
    return mapLifecycle(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('transition_lifecycle', error)
  }
}

export async function claimOpinionFillIdentity(params: {
  decisionId: string
  executorWallet: string
  fillIdentity: string
}): Promise<boolean> {
  const decisionId = requiredText(params.decisionId, 64)
  const executorWallet = normalizeWallet(params.executorWallet)
  const fillIdentity = requiredText(params.fillIdentity, 96)
  if (!decisionId || !executorWallet || !fillIdentity) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql<{ owned: boolean }>`
      INSERT INTO alfaclub.inverse_opinion_fill_claims (
        executor_wallet,
        fill_identity,
        decision_id
      ) VALUES (
        ${executorWallet},
        ${fillIdentity},
        ${decisionId}::uuid
      )
      ON CONFLICT (executor_wallet, fill_identity) DO UPDATE
      SET decision_id = alfaclub.inverse_opinion_fill_claims.decision_id
      RETURNING decision_id = ${decisionId}::uuid AS owned;
    `
    return result.rows?.[0]?.owned === true
  } catch (error) {
    throw storeFailure('claim_fill_identity', error)
  }
}

export async function claimOpinionFillIdentities(params: {
  decisionId: string
  executorWallet: string
  fillIdentities: string[]
}): Promise<boolean> {
  const decisionId = requiredText(params.decisionId, 64)
  const executorWallet = normalizeWallet(params.executorWallet)
  const fillIdentities = [...new Set(
    params.fillIdentities.map((identity) => requiredText(identity, 96)),
  )]
  if (
    !decisionId
    || !executorWallet
    || fillIdentities.length === 0
    || fillIdentities.some((identity) => !identity)
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  await getReadyDb()
  try {
    const claimed = await runInTransaction(async (db) => {
      await db.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${executorWallet}, 0));
      `
      const existing = await db.sql<{ fill_identity: string; decision_id: string }>`
        SELECT fill_identity, decision_id::text AS decision_id
        FROM alfaclub.inverse_opinion_fill_claims
        WHERE executor_wallet = ${executorWallet}
          AND fill_identity IN (
            SELECT jsonb_array_elements_text(${JSON.stringify(fillIdentities)}::jsonb)
          );
      `
      if (existing.rows.some((row) => row.decision_id !== decisionId)) return false
      const inserted = await db.sql<{ fill_identity: string }>`
        INSERT INTO alfaclub.inverse_opinion_fill_claims (
          executor_wallet,
          fill_identity,
          decision_id
        )
        SELECT
          ${executorWallet},
          requested.fill_identity,
          ${decisionId}::uuid
        FROM jsonb_array_elements_text(
          ${JSON.stringify(fillIdentities)}::jsonb
        ) AS requested(fill_identity)
        ON CONFLICT (executor_wallet, fill_identity) DO NOTHING
        RETURNING fill_identity;
      `
      return existing.rows.length + inserted.rows.length === fillIdentities.length
    })
    if (claimed == null) throw new OpinionTradeStoreError('db_unavailable')
    return claimed
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('claim_fill_identities', error)
  }
}

export async function reserveOpinionFillIdentities(params: {
  decisionId: string
  executorWallet: string
  fillIdentities: string[]
}): Promise<boolean> {
  const decisionId = requiredText(params.decisionId, 64)
  const executorWallet = normalizeWallet(params.executorWallet)
  const fillIdentities = [...new Set(
    params.fillIdentities.map((identity) => requiredText(identity, 96)),
  )]
  if (
    !decisionId
    || !executorWallet
    || fillIdentities.length === 0
    || fillIdentities.some((identity) => !identity)
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  await getReadyDb()
  try {
    const reserved = await runInTransaction(async (db) => {
      await db.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${executorWallet}, 0));
      `
      const existing = await db.sql<{ fill_identity: string; decision_id: string }>`
        SELECT fill_identity, decision_id::text AS decision_id
        FROM alfaclub.inverse_opinion_fill_claims
        WHERE executor_wallet = ${executorWallet}
          AND fill_identity IN (
            SELECT jsonb_array_elements_text(${JSON.stringify(fillIdentities)}::jsonb)
          );
      `
      const inserted = await db.sql<{ fill_identity: string }>`
        INSERT INTO alfaclub.inverse_opinion_fill_claims (
          executor_wallet,
          fill_identity,
          decision_id
        )
        SELECT
          ${executorWallet},
          requested.fill_identity,
          ${decisionId}::uuid
        FROM jsonb_array_elements_text(
          ${JSON.stringify(fillIdentities)}::jsonb
        ) AS requested(fill_identity)
        ON CONFLICT (executor_wallet, fill_identity) DO NOTHING
        RETURNING fill_identity;
      `
      const hasForeignClaim = existing.rows.some((row) => row.decision_id !== decisionId)
      return (
        !hasForeignClaim
        && existing.rows.length + inserted.rows.length === fillIdentities.length
      )
    })
    if (reserved == null) throw new OpinionTradeStoreError('db_unavailable')
    return reserved
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('reserve_fill_identities', error)
  }
}

export async function recordUnknownReconciliationCheck(params: {
  decisionId: string
  checkedAt: string
}): Promise<{ decision: OpinionTradeDecision; expired: boolean }> {
  const decisionId = requiredText(params.decisionId, 64)
  const checkedAt = validIsoTimestamp(params.checkedAt)
  if (!decisionId || !checkedAt) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<DecisionRow>`
      UPDATE alfaclub.inverse_opinion_trade_decisions
      SET
        execution_phase = CASE
          WHEN recovery_deadline_at <= ${checkedAt}::timestamptz THEN 'resolved'
          ELSE 'unknown'
        END,
        terminal_outcome = CASE
          WHEN recovery_deadline_at <= ${checkedAt}::timestamptz THEN 'incomplete'
          ELSE NULL
        END,
        reason_code = CASE
          WHEN recovery_deadline_at <= ${checkedAt}::timestamptz
            THEN 'execution_evidence_window_expired'
          ELSE reason_code
        END,
        recovery_attempt_count = recovery_attempt_count + 1,
        recovery_last_checked_at = ${checkedAt}::timestamptz,
        resolved_at = CASE
          WHEN recovery_deadline_at <= ${checkedAt}::timestamptz
            THEN ${checkedAt}::timestamptz
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE decision_id = ${decisionId}::uuid
        AND execution_phase = 'unknown'
      RETURNING
        decision_id,
        source_message_id,
        intent_ordinal,
        normalized_market,
        source_side,
        inverse_side,
        execution_phase,
        terminal_outcome,
        reason_code,
        executor_wallet,
        requested_parameters,
        receipt_summary,
        attribution_quality,
        observed_at::text AS observed_at,
        submitted_at::text AS submitted_at,
        resolved_at::text AS resolved_at,
        updated_at::text AS updated_at,
        NULL::text AS execution_claim_token,
        execution_attempt_count,
        recovery_attempt_count,
        recovery_last_checked_at::text AS recovery_last_checked_at,
        recovery_deadline_at::text AS recovery_deadline_at,
        FALSE AS execution_claimed;
    `
    const row = result.rows?.[0]
    if (!row) throw new OpinionTradeStoreError('reconciliation_conflict')
    const decision = mapDecision(row)
    return { decision, expired: decision.terminalOutcome === 'incomplete' }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('record_unknown_check', error)
  }
}

export async function listOpinionDecisionsForReconciliation(params?: {
  limit?: number
}): Promise<OpinionTradeDecision[]> {
  const limit = Math.min(500, Math.max(1, Math.floor(params?.limit ?? 100)))
  const db = await getReadyDb()
  try {
    const result = await db.sql<DecisionRow>`
      SELECT
        d.decision_id,
        d.source_message_id,
        d.intent_ordinal,
        d.normalized_market,
        d.source_side,
        d.inverse_side,
        d.execution_phase,
        d.terminal_outcome,
        d.reason_code,
        d.executor_wallet,
        d.requested_parameters,
        d.receipt_summary,
        d.attribution_quality,
        d.observed_at::text AS observed_at,
        d.submitted_at::text AS submitted_at,
        d.resolved_at::text AS resolved_at,
        d.updated_at::text AS updated_at
      FROM alfaclub.inverse_opinion_trade_decisions AS d
      WHERE (
        d.execution_phase = 'unknown'
        OR (
          d.execution_phase = 'submitted'
          AND d.recovery_deadline_at <= NOW()
        )
        OR d.terminal_outcome = 'executed'
        OR (
          d.terminal_outcome = 'incomplete'
          AND EXISTS (
            SELECT 1
            FROM alfaclub.inverse_position_lifecycles AS l
            WHERE l.lifecycle_state NOT IN ('closed', 'incomplete')
              AND (
                l.opening_decision_id = d.decision_id
                OR EXISTS (
                  SELECT 1
                  FROM alfaclub.inverse_position_lifecycle_events AS e
                  WHERE e.lifecycle_id = l.lifecycle_id
                    AND e.decision_id = d.decision_id
                )
              )
          )
        )
      )
        AND NOT EXISTS (
          SELECT 1
          FROM alfaclub.inverse_position_lifecycles AS l
          WHERE l.lifecycle_state = 'closed'
            AND (
              l.opening_decision_id = d.decision_id
              OR EXISTS (
                SELECT 1
                FROM alfaclub.inverse_position_lifecycle_events AS e
                WHERE e.lifecycle_id = l.lifecycle_id
                  AND e.decision_id = d.decision_id
              )
            )
        )
      ORDER BY
        CASE
          WHEN d.execution_phase = 'unknown' THEN 0
          WHEN d.execution_phase = 'submitted' AND d.recovery_deadline_at <= NOW() THEN 1
          WHEN d.terminal_outcome = 'incomplete' THEN 2
          ELSE 3
        END ASC,
        CASE WHEN d.receipt_summary ? 'fill' THEN 0 ELSE 1 END ASC,
        COALESCE(d.submitted_at, d.observed_at) ASC,
        d.decision_id ASC
      LIMIT ${limit};
    `
    return (result.rows ?? []).map(mapDecision)
  } catch (error) {
    throw storeFailure('list_decisions_for_reconciliation', error, 'db_read_failed')
  }
}

export async function findOpenPositionLifecycle(params: {
  executorWallet: string
  normalizedMarket: string
  side: OpinionSide
}): Promise<PositionLifecycle | null> {
  const executorWallet = normalizeWallet(params.executorWallet)
  const normalizedMarket = normalizeMarket(params.normalizedMarket)
  if (!executorWallet || !normalizedMarket) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleRow>`
      SELECT
        lifecycle_id,
        executor_wallet,
        normalized_market,
        side,
        opening_decision_id,
        lifecycle_state,
        attribution_quality,
        reconciliation_generation,
        opened_at::text AS opened_at,
        closed_at::text AS closed_at,
        last_reconciled_at::text AS last_reconciled_at,
        current_snapshot,
        realized_result,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM alfaclub.inverse_position_lifecycles
      WHERE executor_wallet = ${executorWallet}
        AND normalized_market = ${normalizedMarket}
        AND side = ${params.side}
        AND closed_at IS NULL
      LIMIT 1;
    `
    const row = result.rows?.[0]
    return row ? mapLifecycle(row) : null
  } catch (error) {
    throw storeFailure('find_open_lifecycle', error, 'db_read_failed')
  }
}

export async function listPositionLifecyclesForJournal(params: {
  windowStart: string
  windowEnd: string
}): Promise<PositionLifecycle[]> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  if (!windowStart || !windowEnd || Date.parse(windowStart) >= Date.parse(windowEnd)) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleRow>`
      SELECT
        l.lifecycle_id,
        l.executor_wallet,
        l.normalized_market,
        l.side,
        l.opening_decision_id,
        l.lifecycle_state,
        l.attribution_quality,
        l.reconciliation_generation,
        l.opened_at::text AS opened_at,
        l.closed_at::text AS closed_at,
        l.last_reconciled_at::text AS last_reconciled_at,
        l.current_snapshot,
        l.realized_result,
        l.created_at::text AS created_at,
        l.updated_at::text AS updated_at
      FROM alfaclub.inverse_position_lifecycles AS l
      WHERE l.closed_at IS NULL
        OR (
          l.closed_at >= ${windowStart}::timestamptz
          AND l.closed_at < ${windowEnd}::timestamptz
        )
      ORDER BY COALESCE(l.closed_at, l.opened_at) ASC, l.lifecycle_id ASC;
    `
    return (result.rows ?? []).map(mapLifecycle)
  } catch (error) {
    throw storeFailure('list_lifecycles', error, 'db_read_failed')
  }
}

export async function getOpinionTradeJournalSource(
  lifecycleIdInput: string,
): Promise<OpinionTradeJournalSource | null> {
  const lifecycleId = requiredText(lifecycleIdInput, 64)
  if (!lifecycleId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalSourceRow>`
      SELECT
        l.lifecycle_id,
        d.decision_id,
        s.room_id,
        s.source_message_id,
        s.source_hash,
        s.source_timestamp::text AS source_timestamp,
        d.source_side,
        d.inverse_side,
        d.normalized_market,
        (d.requested_parameters || d.receipt_summary) AS decision_metadata
      FROM alfaclub.inverse_position_lifecycles AS l
      JOIN alfaclub.inverse_opinion_trade_decisions AS d
        ON d.decision_id = l.opening_decision_id
      JOIN alfaclub.inverse_opinion_source_messages AS s
        ON s.source_message_id = d.source_message_id
      WHERE l.lifecycle_id = ${lifecycleId}::uuid
      LIMIT 1;
    `
    const row = result.rows?.[0]
    return row ? mapJournalSource(row) : null
  } catch (error) {
    throw storeFailure('get_journal_source', error, 'db_read_failed')
  }
}

export async function getOpinionTradeJournalPublicAttribution(
  lifecycleIdInput: string,
): Promise<OpinionTradeJournalPublicAttribution | null> {
  const lifecycleId = requiredText(lifecycleIdInput, 64)
  if (!lifecycleId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<{
      lifecycle_id: string
      public_author_label: string | null
      sender_address: string | null
    }>`
      SELECT
        l.lifecycle_id,
        s.public_author_label,
        s.sender_address
      FROM alfaclub.inverse_position_lifecycles AS l
      JOIN alfaclub.inverse_opinion_trade_decisions AS d
        ON d.decision_id = l.opening_decision_id
      JOIN alfaclub.inverse_opinion_source_messages AS s
        ON s.source_message_id = d.source_message_id
      WHERE l.lifecycle_id = ${lifecycleId}::uuid
      LIMIT 1;
    `
    const row = result.rows?.[0]
    return row
      ? {
          lifecycleId: row.lifecycle_id,
          publicAuthorLabel: row.public_author_label,
          senderAddress: row.sender_address,
        }
      : null
  } catch (error) {
    throw storeFailure('get_journal_public_attribution', error, 'db_read_failed')
  }
}

export async function listOpinionTradeJournalInfluences(
  lifecycleIdInput: string,
): Promise<OpinionTradeJournalInfluence[]> {
  const lifecycleId = requiredText(lifecycleIdInput, 64)
  if (!lifecycleId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalInfluenceRow>`
      WITH influence_decisions AS (
        SELECT
          l.opening_decision_id AS decision_id,
          'open'::text AS action,
          l.opened_at AS occurred_at
        FROM alfaclub.inverse_position_lifecycles AS l
        WHERE l.lifecycle_id = ${lifecycleId}::uuid
        UNION ALL
        SELECT
          e.decision_id,
          e.event_type::text AS action,
          e.occurred_at
        FROM alfaclub.inverse_position_lifecycle_events AS e
        WHERE e.lifecycle_id = ${lifecycleId}::uuid
          AND e.decision_id IS NOT NULL
      ), deduplicated AS (
        SELECT DISTINCT ON (decision_id)
          decision_id,
          action,
          occurred_at
        FROM influence_decisions
        ORDER BY decision_id, occurred_at ASC
      )
      SELECT
        d.decision_id,
        s.room_id,
        s.public_author_label,
        s.sender_address,
        d.source_side,
        d.normalized_market,
        influence.action,
        influence.occurred_at::text AS occurred_at
      FROM deduplicated AS influence
      JOIN alfaclub.inverse_opinion_trade_decisions AS d
        ON d.decision_id = influence.decision_id
      JOIN alfaclub.inverse_opinion_source_messages AS s
        ON s.source_message_id = d.source_message_id
      WHERE d.terminal_outcome = 'executed'
      ORDER BY influence.occurred_at ASC, d.decision_id ASC;
    `
    return (result.rows ?? []).map(mapJournalInfluence)
  } catch (error) {
    throw storeFailure('list_journal_influences', error, 'db_read_failed')
  }
}

export async function listPositionLifecycleEvents(
  lifecycleIdInput: string,
): Promise<PositionLifecycleEvent[]> {
  const lifecycleId = requiredText(lifecycleIdInput, 64)
  if (!lifecycleId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<LifecycleEventRow>`
      SELECT
        event_id,
        lifecycle_id,
        decision_id,
        event_key,
        event_type,
        evidence_layer,
        analysis_verdict,
        event_payload,
        occurred_at::text AS occurred_at,
        created_at::text AS created_at
      FROM alfaclub.inverse_position_lifecycle_events
      WHERE lifecycle_id = ${lifecycleId}::uuid
      ORDER BY occurred_at ASC, event_id ASC;
    `
    return (result.rows ?? []).map(mapLifecycleEvent)
  } catch (error) {
    throw storeFailure('list_lifecycle_events', error, 'db_read_failed')
  }
}

export async function listOpinionTradeJournalAnalyses(
  lifecycleIdInput: string,
): Promise<OpinionTradeJournalAnalysisSnapshot[]> {
  const lifecycleId = requiredText(lifecycleIdInput, 64)
  if (!lifecycleId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalAnalysisRow>`
      SELECT
        analysis_id,
        lifecycle_id,
        reporting_window_start::text AS reporting_window_start,
        reporting_window_end::text AS reporting_window_end,
        evidence_bundle,
        interpretation,
        verdict,
        confidence,
        evidence_refs,
        invalidation_condition,
        watch_condition,
        closed_thesis_assessment,
        model_name,
        model_version,
        analysis_only,
        failure_reason,
        created_at::text AS created_at
      FROM alfaclub.inverse_opinion_trade_analyses
      WHERE lifecycle_id = ${lifecycleId}::uuid
      ORDER BY created_at ASC, analysis_id ASC;
    `
    return (result.rows ?? []).map(mapJournalAnalysis)
  } catch (error) {
    throw storeFailure('list_journal_analyses', error, 'db_read_failed')
  }
}

export async function persistOpinionTradeJournalAnalysis(params: {
  lifecycleId: string
  reportingWindowStart: string
  reportingWindowEnd: string
  evidenceBundle: Record<string, unknown>
  interpretation: Record<string, unknown>
  verdict: AnalysisVerdict
  confidence: number
  evidenceRefs: string[]
  invalidationCondition: string
  watchCondition: string
  closedThesisAssessment?: ClosedThesisAssessment | null
  modelName: string
  modelVersion?: string | null
  analysisOnly: true
  failureReason?: string | null
}): Promise<OpinionTradeJournalAnalysisSnapshot> {
  const lifecycleId = requiredText(params.lifecycleId, 64)
  const windowStart = validIsoTimestamp(params.reportingWindowStart)
  const windowEnd = validIsoTimestamp(params.reportingWindowEnd)
  const invalidationCondition = requiredText(params.invalidationCondition, 2_000)
  const watchCondition = requiredText(params.watchCondition, 2_000)
  const modelName = requiredText(params.modelName, 120)
  const modelVersion =
    params.modelVersion == null ? null : requiredText(params.modelVersion, 120)
  const failureReason =
    params.failureReason == null ? null : requiredText(params.failureReason, 128)
  const confidence = Number(params.confidence)
  const evidenceRefs = [...new Set(params.evidenceRefs.map((value) => String(value).trim()))]
    .filter(Boolean)
  const validVerdicts: AnalysisVerdict[] = ['hold', 'add', 'trim', 'exit', 'watch']
  const validClosedAssessments: ClosedThesisAssessment[] = [
    'correct',
    'early',
    'late',
    'invalidated',
  ]
  if (
    !lifecycleId
    || !windowStart
    || !windowEnd
    || Date.parse(windowStart) >= Date.parse(windowEnd)
    || !invalidationCondition
    || !watchCondition
    || !modelName
    || (params.modelVersion != null && !modelVersion)
    || (params.failureReason != null && !failureReason)
    || !Number.isFinite(confidence)
    || confidence < 0
    || confidence > 1
    || params.analysisOnly !== true
    || !validVerdicts.includes(params.verdict)
    || (
      params.closedThesisAssessment != null
      && !validClosedAssessments.includes(params.closedThesisAssessment)
    )
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalAnalysisRow>`
      INSERT INTO alfaclub.inverse_opinion_trade_analyses (
        lifecycle_id,
        reporting_window_start,
        reporting_window_end,
        evidence_bundle,
        interpretation,
        verdict,
        confidence,
        evidence_refs,
        invalidation_condition,
        watch_condition,
        closed_thesis_assessment,
        model_name,
        model_version,
        analysis_only,
        failure_reason
      ) VALUES (
        ${lifecycleId}::uuid,
        ${windowStart}::timestamptz,
        ${windowEnd}::timestamptz,
        ${JSON.stringify(params.evidenceBundle)}::jsonb,
        ${JSON.stringify(params.interpretation)}::jsonb,
        ${params.verdict},
        ${confidence},
        ${JSON.stringify(evidenceRefs)}::jsonb,
        ${invalidationCondition},
        ${watchCondition},
        ${params.closedThesisAssessment ?? null},
        ${modelName},
        ${modelVersion},
        TRUE,
        ${failureReason}
      )
      RETURNING
        analysis_id,
        lifecycle_id,
        reporting_window_start::text AS reporting_window_start,
        reporting_window_end::text AS reporting_window_end,
        evidence_bundle,
        interpretation,
        verdict,
        confidence,
        evidence_refs,
        invalidation_condition,
        watch_condition,
        closed_thesis_assessment,
        model_name,
        model_version,
        analysis_only,
        failure_reason,
        created_at::text AS created_at;
    `
    const row = result.rows?.[0]
    if (!row || row.analysis_only !== true) {
      throw new OpinionTradeStoreError('analysis_persist_failed')
    }
    return mapJournalAnalysis(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('persist_journal_analysis', error)
  }
}

export async function listOpinionTradeJournalDecisions(params: {
  windowStart: string
  windowEnd: string
}): Promise<OpinionTradeJournalDecision[]> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  if (!windowStart || !windowEnd || Date.parse(windowStart) >= Date.parse(windowEnd)) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalDecisionRow>`
      SELECT
        d.decision_id,
        d.execution_phase,
        d.terminal_outcome,
        d.reason_code,
        d.normalized_market,
        d.source_side,
        d.inverse_side,
        s.room_id,
        s.public_author_label,
        s.sender_address,
        s.source_timestamp::text AS source_timestamp
      FROM alfaclub.inverse_opinion_trade_decisions AS d
      JOIN alfaclub.inverse_opinion_source_messages AS s
        ON s.source_message_id = d.source_message_id
      WHERE d.observed_at >= ${windowStart}::timestamptz
        AND d.observed_at < ${windowEnd}::timestamptz
      ORDER BY d.observed_at ASC, d.decision_id ASC;
    `
    return (result.rows ?? []).map(mapJournalDecision)
  } catch (error) {
    throw storeFailure('list_journal_decisions', error, 'db_read_failed')
  }
}

export async function claimOpinionTradeJournalDispatch(params: {
  roomId: '1659'
  windowStart: string
  windowEnd: string
  claimantToken: string
  leaseSeconds: number
  clientMessageId: string
}): Promise<{ won: boolean; dispatch: OpinionTradeJournalDispatch }> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  const clientMessageId = requiredText(params.clientMessageId, 160)
  const leaseSeconds = Math.floor(params.leaseSeconds)
  if (
    params.roomId !== '1659'
    || !windowStart
    || !windowEnd
    || Date.parse(windowEnd) - Date.parse(windowStart) !== 86_400_000
    || !claimantToken
    || !/^[a-f0-9-]{36}$/i.test(claimantToken)
    || !clientMessageId
    || !Number.isFinite(leaseSeconds)
    || leaseSeconds < 30
    || leaseSeconds > 900
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    await db.sql`
      WITH expired AS (
        SELECT
          dispatch.dispatch_id,
          EXISTS (
            SELECT 1
            FROM alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
            WHERE delivery.dispatch_id = dispatch.dispatch_id
              AND delivery.delivery_state = 'sending'
          ) AS outcome_unknown
        FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
        WHERE dispatch.room_id = '1659'
          AND dispatch.reporting_window_start = ${windowStart}::timestamptz
          AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
          AND dispatch.dispatch_state = 'sending'
          AND dispatch.lease_expires_at <= NOW()
        FOR UPDATE
      ), expired_delivery AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
        SET delivery_state = 'send_unknown',
            last_error_code = 'sending_lease_expired',
            updated_at = NOW()
        FROM expired
        WHERE delivery.dispatch_id = expired.dispatch_id
          AND delivery.delivery_state = 'sending'
        RETURNING delivery.delivery_id
      )
      UPDATE alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      SET dispatch_state = CASE
            WHEN expired.outcome_unknown THEN 'send_unknown'
            ELSE 'failed'
          END,
          last_error_code = CASE
            WHEN expired.outcome_unknown THEN 'sending_lease_expired'
            ELSE 'sending_lease_expired_safe_to_resume'
          END,
          updated_at = NOW()
      FROM expired
      WHERE dispatch.dispatch_id = expired.dispatch_id;
    `
    const result = await db.sql<JournalDispatchRow & { won: boolean }>`
      INSERT INTO alfaclub.inverse_opinion_trade_journal_dispatch (
        room_id,
        reporting_window_start,
        reporting_window_end,
        dispatch_state,
        claimant_token,
        lease_expires_at,
        attempt_count,
        client_message_id
      ) VALUES (
        '1659',
        ${windowStart}::timestamptz,
        ${windowEnd}::timestamptz,
        'claimed',
        ${claimantToken}::uuid,
        NOW() + (${leaseSeconds} * INTERVAL '1 second'),
        1,
        ${clientMessageId}
      )
      ON CONFLICT (room_id, reporting_window_start, reporting_window_end)
      DO UPDATE SET
        dispatch_state = 'claimed',
        claimant_token = EXCLUDED.claimant_token,
        lease_expires_at = EXCLUDED.lease_expires_at,
        attempt_count = alfaclub.inverse_opinion_trade_journal_dispatch.attempt_count + 1,
        updated_at = NOW(),
        last_error_code = NULL
      WHERE alfaclub.inverse_opinion_trade_journal_dispatch.dispatch_state = 'failed'
        OR (
          alfaclub.inverse_opinion_trade_journal_dispatch.dispatch_state = 'claimed'
          AND alfaclub.inverse_opinion_trade_journal_dispatch.lease_expires_at <= NOW()
        )
      RETURNING
        dispatch_id,
        room_id,
        reporting_window_start::text AS reporting_window_start,
        reporting_window_end::text AS reporting_window_end,
        dispatch_state,
        claimant_token::text AS claimant_token,
        client_message_id,
        parent_message_id,
        attempt_count,
        analysis_revision,
        claimant_token = ${claimantToken}::uuid AS won;
    `
    const claimedRow = result.rows?.[0]
    let row: (JournalDispatchRow & { won?: boolean }) | undefined = claimedRow
    if (!row) {
      const existing = await db.sql<JournalDispatchRow>`
        SELECT
          dispatch_id,
          room_id,
          reporting_window_start::text AS reporting_window_start,
          reporting_window_end::text AS reporting_window_end,
          dispatch_state,
          claimant_token::text AS claimant_token,
          client_message_id,
          parent_message_id,
          attempt_count,
          analysis_revision
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE room_id = '1659'
          AND reporting_window_start = ${windowStart}::timestamptz
          AND reporting_window_end = ${windowEnd}::timestamptz
        LIMIT 1;
      `
      row = existing.rows?.[0]
    }
    if (!row) throw new OpinionTradeStoreError('dispatch_claim_failed')
    return {
      won: Boolean(claimedRow),
      dispatch: mapJournalDispatch(row),
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('claim_journal_dispatch', error)
  }
}

export async function transitionOpinionTradeJournalDispatch(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  state: Exclude<JournalDispatchState, 'claimed'>
  parentMessageId?: string | null
  contentHash?: string | null
  errorCode?: string | null
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  const parentMessageId =
    params.parentMessageId == null ? null : requiredText(params.parentMessageId, 256)
  const contentHash = params.contentHash == null ? null : requiredText(params.contentHash, 64)
  const errorCode = params.errorCode == null ? null : requiredText(params.errorCode, 128)
  if (
    !windowStart
    || !windowEnd
    || !claimantToken
    || !['sending', 'sent', 'failed', 'send_unknown'].includes(params.state)
    || (params.state === 'sent' && (!parentMessageId || !/^[a-f0-9]{64}$/.test(contentHash ?? '')))
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_dispatch
      SET
        dispatch_state = ${params.state},
        parent_message_id = COALESCE(${parentMessageId}, parent_message_id),
        content_hash = COALESCE(${contentHash}, content_hash),
        sent_at = CASE WHEN ${params.state} = 'sent' THEN NOW() ELSE sent_at END,
        last_error_code = ${errorCode},
        updated_at = NOW()
      WHERE room_id = '1659'
        AND reporting_window_start = ${windowStart}::timestamptz
        AND reporting_window_end = ${windowEnd}::timestamptz
        AND claimant_token = ${claimantToken}::uuid
        AND dispatch_state IN ('claimed', 'sending')
      RETURNING dispatch_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('dispatch_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('transition_journal_dispatch', error)
  }
}

export async function renewOpinionTradeJournalDispatch(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  leaseSeconds: number
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  const leaseSeconds = Math.floor(params.leaseSeconds)
  if (
    !windowStart
    || !windowEnd
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || leaseSeconds < 30
    || leaseSeconds > 900
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_dispatch
      SET lease_expires_at = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
          updated_at = NOW()
      WHERE room_id = '1659'
        AND reporting_window_start = ${windowStart}::timestamptz
        AND reporting_window_end = ${windowEnd}::timestamptz
        AND claimant_token = ${claimantToken}::uuid
        AND dispatch_state IN ('claimed', 'sending')
        AND lease_expires_at > NOW()
      RETURNING dispatch_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('dispatch_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('renew_journal_dispatch', error)
  }
}

export async function prepareOpinionTradeJournalDeliveries(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  deliveries: Array<{
    kind: 'parent' | 'reply'
    ordinal: number
    clientMessageId: string
    contentHash: string
    content: string
  }>
}): Promise<OpinionTradeJournalDelivery[]> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  if (
    !windowStart
    || !windowEnd
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || params.deliveries.length < 1
    || params.deliveries.length > 101
    || params.deliveries.some((delivery) => (
      !['parent', 'reply'].includes(delivery.kind)
      || !Number.isInteger(delivery.ordinal)
      || delivery.ordinal < 0
      || (delivery.kind === 'parent' && delivery.ordinal !== 0)
      || !requiredText(delivery.clientMessageId, 160)
      || !/^[a-f0-9]{64}$/.test(delivery.contentHash)
      || !requiredText(delivery.content, 2_000)
    ))
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const deliveryPlan = params.deliveries.map((delivery) => ({
      delivery_kind: delivery.kind,
      delivery_ordinal: delivery.ordinal,
      client_message_id: delivery.clientMessageId,
      content_hash: delivery.contentHash,
      public_text: delivery.content,
    }))
    await db.sql`
      WITH owned AS (
        SELECT dispatch_id
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE room_id = '1659'
          AND reporting_window_start = ${windowStart}::timestamptz
          AND reporting_window_end = ${windowEnd}::timestamptz
          AND claimant_token = ${claimantToken}::uuid
          AND dispatch_state IN ('claimed', 'sending')
          AND lease_expires_at > NOW()
      ), plan AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(deliveryPlan)}::jsonb) AS delivery(
          delivery_kind text,
          delivery_ordinal integer,
          client_message_id text,
          content_hash text,
          public_text text
        )
      )
      INSERT INTO alfaclub.inverse_opinion_trade_journal_deliveries (
        dispatch_id,
        delivery_kind,
        delivery_ordinal,
        client_message_id,
        content_hash,
        public_text
      )
      SELECT
        owned.dispatch_id,
        plan.delivery_kind,
        plan.delivery_ordinal,
        plan.client_message_id,
        plan.content_hash,
        plan.public_text
      FROM owned
      CROSS JOIN plan
      ON CONFLICT (dispatch_id, delivery_kind, delivery_ordinal) DO NOTHING;
    `
    const deliveries = await listOpinionTradeJournalDeliveries({ windowStart, windowEnd })
    if (deliveries.length !== params.deliveries.length) {
      throw new OpinionTradeStoreError('delivery_plan_mismatch')
    }
    for (const expected of params.deliveries) {
      const actual = deliveries.find((delivery) => (
        delivery.kind === expected.kind && delivery.ordinal === expected.ordinal
      ))
      if (
        !actual
        || actual.clientMessageId !== expected.clientMessageId
        || actual.contentHash !== expected.contentHash
        || actual.content !== expected.content
      ) {
        throw new OpinionTradeStoreError('delivery_plan_mismatch')
      }
    }
    return deliveries
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('prepare_journal_deliveries', error)
  }
}

export async function listOpinionTradeJournalDeliveries(params: {
  windowStart: string
  windowEnd: string
}): Promise<OpinionTradeJournalDelivery[]> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  if (!windowStart || !windowEnd) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalDeliveryRow>`
      SELECT
        delivery.delivery_kind,
        delivery.delivery_ordinal,
        delivery.delivery_state,
        delivery.client_message_id,
        delivery.content_hash,
        delivery.public_text,
        delivery.message_id
      FROM alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
      JOIN alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
        ON dispatch.dispatch_id = delivery.dispatch_id
      WHERE dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
      ORDER BY
        CASE WHEN delivery.delivery_kind = 'parent' THEN 0 ELSE 1 END,
        delivery.delivery_ordinal ASC;
    `
    return (result.rows ?? []).map(mapJournalDelivery)
  } catch (error) {
    throw storeFailure('list_journal_deliveries', error, 'db_read_failed')
  }
}

export async function markOpinionTradeJournalDeliverySending(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  kind: 'parent' | 'reply'
  ordinal: number
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  if (
    !windowStart
    || !windowEnd
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || !['parent', 'reply'].includes(params.kind)
    || !Number.isInteger(params.ordinal)
    || params.ordinal < 0
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
      SET delivery_state = 'sending',
          updated_at = NOW()
      FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      WHERE delivery.dispatch_id = dispatch.dispatch_id
        AND dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
        AND dispatch.claimant_token = ${claimantToken}::uuid
        AND dispatch.dispatch_state = 'sending'
        AND dispatch.lease_expires_at > NOW()
        AND delivery.delivery_kind = ${params.kind}
        AND delivery.delivery_ordinal = ${params.ordinal}
        AND delivery.delivery_state IN ('pending', 'failed')
      RETURNING delivery.delivery_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('delivery_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('mark_journal_delivery_sending', error)
  }
}

export async function recordOpinionTradeJournalDeliverySent(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  kind: 'parent' | 'reply'
  ordinal: number
  messageId: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  const messageId = requiredText(params.messageId, 256)
  if (
    !windowStart
    || !windowEnd
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || !['parent', 'reply'].includes(params.kind)
    || !Number.isInteger(params.ordinal)
    || params.ordinal < 0
    || !messageId
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      WITH owned AS (
        SELECT dispatch_id
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE room_id = '1659'
          AND reporting_window_start = ${windowStart}::timestamptz
          AND reporting_window_end = ${windowEnd}::timestamptz
          AND claimant_token = ${claimantToken}::uuid
          AND dispatch_state = 'sending'
          AND lease_expires_at > NOW()
      ), delivered AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
        SET delivery_state = 'sent',
            message_id = ${messageId},
            sent_at = NOW(),
            last_error_code = NULL,
            updated_at = NOW()
        FROM owned
        WHERE delivery.dispatch_id = owned.dispatch_id
          AND delivery.delivery_kind = ${params.kind}
          AND delivery.delivery_ordinal = ${params.ordinal}
          AND delivery.delivery_state IN ('pending', 'sending', 'failed')
        RETURNING delivery.dispatch_id
      )
      UPDATE alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      SET parent_message_id = CASE
            WHEN ${params.kind} = 'parent' THEN ${messageId}
            ELSE dispatch.parent_message_id
          END,
          updated_at = NOW()
      FROM delivered
      WHERE dispatch.dispatch_id = delivered.dispatch_id
      RETURNING dispatch.dispatch_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('delivery_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('record_journal_delivery_sent', error)
  }
}

export async function recordOpinionTradeJournalDeliveryFailure(params: {
  windowStart: string
  windowEnd: string
  claimantToken: string
  kind: 'parent' | 'reply'
  ordinal: number
  state: 'failed' | 'send_unknown'
  errorCode: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const claimantToken = requiredText(params.claimantToken, 64)
  const errorCode = requiredText(params.errorCode, 128)
  if (
    !windowStart
    || !windowEnd
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || !['parent', 'reply'].includes(params.kind)
    || !Number.isInteger(params.ordinal)
    || params.ordinal < 0
    || !['failed', 'send_unknown'].includes(params.state)
    || !errorCode
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      WITH updated_delivery AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
        SET delivery_state = ${params.state},
            last_error_code = ${errorCode},
            updated_at = NOW()
        FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
        WHERE delivery.dispatch_id = dispatch.dispatch_id
          AND dispatch.room_id = '1659'
          AND dispatch.reporting_window_start = ${windowStart}::timestamptz
          AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
          AND dispatch.claimant_token = ${claimantToken}::uuid
          AND dispatch.dispatch_state = 'sending'
          AND delivery.delivery_kind = ${params.kind}
          AND delivery.delivery_ordinal = ${params.ordinal}
          AND delivery.delivery_state <> 'sent'
        RETURNING delivery.dispatch_id
      )
      UPDATE alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      SET dispatch_state = ${params.state},
          last_error_code = ${errorCode},
          updated_at = NOW()
      FROM updated_delivery
      WHERE dispatch.dispatch_id = updated_delivery.dispatch_id
      RETURNING dispatch.dispatch_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('delivery_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('record_journal_delivery_failure', error)
  }
}

export async function getOpinionTradeJournalDispatch(params: {
  windowStart: string
  windowEnd: string
}): Promise<OpinionTradeJournalDispatch | null> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  if (!windowStart || !windowEnd) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<JournalDispatchRow>`
      SELECT
        dispatch_id,
        room_id,
        reporting_window_start::text AS reporting_window_start,
        reporting_window_end::text AS reporting_window_end,
        dispatch_state,
        claimant_token::text AS claimant_token,
        client_message_id,
        parent_message_id,
        attempt_count,
        analysis_revision
      FROM alfaclub.inverse_opinion_trade_journal_dispatch
      WHERE room_id = '1659'
        AND reporting_window_start = ${windowStart}::timestamptz
        AND reporting_window_end = ${windowEnd}::timestamptz
      LIMIT 1;
    `
    const row = result.rows?.[0]
    return row ? mapJournalDispatch(row) : null
  } catch (error) {
    throw storeFailure('get_journal_dispatch', error, 'db_read_failed')
  }
}

export async function resolveOpinionTradeJournalSendUnknown(params: {
  windowStart: string
  windowEnd: string
  operatorAddress: string
  resolution: 'mark_sent' | 'mark_failed'
  deliveryKind: 'parent' | 'reply'
  deliveryOrdinal: number
  knownMessageId?: string | null
  note: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const operatorAddress = normalizeWallet(params.operatorAddress)
  const knownMessageId =
    params.knownMessageId == null ? null : requiredText(params.knownMessageId, 256)
  const note = requiredText(params.note, 500)
  if (
    !windowStart
    || !windowEnd
    || !operatorAddress
    || !['mark_sent', 'mark_failed'].includes(params.resolution)
    || !['parent', 'reply'].includes(params.deliveryKind)
    || !Number.isInteger(params.deliveryOrdinal)
    || params.deliveryOrdinal < 0
    || (params.deliveryKind === 'parent' && params.deliveryOrdinal !== 0)
    || !note
    || note.length < 8
    || (params.resolution === 'mark_sent' && !knownMessageId)
    || (params.resolution === 'mark_failed' && knownMessageId != null)
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const deliveryState = params.resolution === 'mark_sent' ? 'sent' : 'failed'
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      WITH resolved_delivery AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_deliveries AS delivery
        SET delivery_state = ${deliveryState},
            message_id = CASE
              WHEN ${params.resolution} = 'mark_sent' THEN ${knownMessageId}
              ELSE NULL
            END,
            sent_at = CASE
              WHEN ${params.resolution} = 'mark_sent' THEN NOW()
              ELSE NULL
            END,
            last_error_code = CASE
              WHEN ${params.resolution} = 'mark_failed'
                THEN 'operator_confirmed_absent'
              ELSE NULL
            END,
            updated_at = NOW()
        FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
        WHERE delivery.dispatch_id = dispatch.dispatch_id
          AND dispatch.room_id = '1659'
          AND dispatch.reporting_window_start = ${windowStart}::timestamptz
          AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
          AND dispatch.dispatch_state = 'send_unknown'
          AND delivery.delivery_kind = ${params.deliveryKind}
          AND delivery.delivery_ordinal = ${params.deliveryOrdinal}
          AND delivery.delivery_state = 'send_unknown'
        RETURNING delivery.dispatch_id
      ), resolved_dispatch AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
        SET dispatch_state = 'failed',
            parent_message_id = CASE
              WHEN ${params.resolution} = 'mark_sent' AND ${params.deliveryKind} = 'parent'
                THEN ${knownMessageId}
              ELSE dispatch.parent_message_id
            END,
            last_error_code = 'operator_resolved_send_unknown',
            updated_at = NOW()
        FROM resolved_delivery
        WHERE dispatch.dispatch_id = resolved_delivery.dispatch_id
          AND dispatch.dispatch_state = 'send_unknown'
        RETURNING dispatch.dispatch_id
      ), audited AS (
        INSERT INTO alfaclub.inverse_opinion_trade_journal_resolution_audit (
          dispatch_id,
          operator_address,
          resolution,
          delivery_kind,
          delivery_ordinal,
          known_message_id,
          operator_note,
          prior_state,
          resulting_state
        )
        SELECT
          dispatch_id,
          ${operatorAddress},
          ${params.resolution},
          ${params.deliveryKind},
          ${params.deliveryOrdinal},
          ${knownMessageId},
          ${note},
          'send_unknown',
          'failed'
        FROM resolved_dispatch
        RETURNING dispatch_id
      )
      SELECT dispatch_id FROM audited;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('send_unknown_resolution_conflict')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('resolve_journal_send_unknown', error)
  }
}

export async function beginOpinionTradeJournalRevision(params: {
  windowStart: string
  windowEnd: string
  operatorAddress: string
  clientMessageIdPrefix: string
  claimantToken?: string
  leaseSeconds?: number
  publicText?: string | null
  expectedRevision?: number
}): Promise<{
  revision: number
  clientMessageId: string
  publicText: string
  claimantToken: string
  recovered: boolean
} | null> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const operatorAddress = normalizeWallet(params.operatorAddress)
  const clientMessageIdPrefix = requiredText(params.clientMessageIdPrefix, 130)
  const claimantToken = params.claimantToken == null
    ? randomUUID()
    : requiredText(params.claimantToken, 64)
  const leaseSeconds = Math.floor(params.leaseSeconds ?? 300)
  const publicText = params.publicText == null ? null : requiredText(params.publicText, 2_000)
  const expectedRevision = params.expectedRevision == null
    ? null
    : Math.floor(params.expectedRevision)
  if (
    !windowStart
    || !windowEnd
    || !operatorAddress
    || !clientMessageIdPrefix
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || leaseSeconds < 30
    || leaseSeconds > 900
    || (params.publicText != null && !publicText)
    || (
      params.expectedRevision != null
      && (!Number.isInteger(expectedRevision) || (expectedRevision ?? 0) <= 0)
    )
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    type RevisionClaimRow = {
      revision: number
      client_message_id: string
      public_text: string | null
      claimant_token: string | null
      recovered: boolean
      blocked?: boolean
    }
    const recovery = await db.sql<RevisionClaimRow>`
      WITH target AS (
        SELECT dispatch_id
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE room_id = '1659'
          AND reporting_window_start = ${windowStart}::timestamptz
          AND reporting_window_end = ${windowEnd}::timestamptz
          AND dispatch_state = 'sent'
          AND parent_message_id IS NOT NULL
      ), uncertain AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
        SET audit_state = 'send_unknown',
            last_error_code = 'revision_sending_lease_expired'
        FROM target
        WHERE audit.dispatch_id = target.dispatch_id
          AND audit.audit_state = 'requested'
          AND audit.lease_expires_at <= NOW()
          AND audit.send_started_at IS NOT NULL
        RETURNING audit.audit_id
      ), recovered AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
        SET claimant_token = ${claimantToken}::uuid,
            lease_expires_at = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
            recovery_attempt_count = audit.recovery_attempt_count + 1,
            last_recovered_at = NOW()
        FROM target
        WHERE audit.dispatch_id = target.dispatch_id
          AND audit.audit_state = 'requested'
          AND audit.lease_expires_at <= NOW()
          AND audit.public_text IS NOT NULL
          AND audit.send_started_at IS NULL
        RETURNING
          audit.revision,
          audit.client_message_id,
          audit.public_text,
          audit.claimant_token::text AS claimant_token
      )
      SELECT
        revision,
        client_message_id,
        public_text,
        claimant_token,
        TRUE AS recovered,
        FALSE AS blocked
      FROM recovered
      UNION ALL
      SELECT
        0,
        '',
        NULL,
        NULL,
        FALSE,
        EXISTS (
          SELECT 1
          FROM alfaclub.inverse_opinion_trade_journal_revision_audit AS unresolved
          WHERE unresolved.dispatch_id = target.dispatch_id
            AND unresolved.audit_state IN ('requested', 'send_unknown')
        ) AS blocked
      FROM target
      WHERE NOT EXISTS (SELECT 1 FROM recovered)
      LIMIT 1;
    `
    const recovered = recovery.rows?.[0]
    if (!recovered) throw new OpinionTradeStoreError('journal_parent_missing')
    if (Number(recovered.revision) > 0) {
      if (!recovered.public_text || !recovered.claimant_token) {
        throw new OpinionTradeStoreError('journal_revision_payload_missing')
      }
      return {
        revision: Number(recovered.revision),
        clientMessageId: recovered.client_message_id,
        publicText: recovered.public_text,
        claimantToken: recovered.claimant_token,
        recovered: true,
      }
    }
    if (recovered.blocked || Number(recovered.revision) === -1) {
      throw new OpinionTradeStoreError('journal_revision_unresolved')
    }
    if (!publicText) return null

    const result = await db.sql<RevisionClaimRow>`
      WITH target AS (
        SELECT dispatch_id
        FROM alfaclub.inverse_opinion_trade_journal_dispatch
        WHERE room_id = '1659'
          AND reporting_window_start = ${windowStart}::timestamptz
          AND reporting_window_end = ${windowEnd}::timestamptz
          AND dispatch_state = 'sent'
          AND parent_message_id IS NOT NULL
      ), bumped AS (
        UPDATE alfaclub.inverse_opinion_trade_journal_dispatch
        SET analysis_revision = analysis_revision + 1, updated_at = NOW()
        WHERE dispatch_id IN (SELECT dispatch_id FROM target)
          AND (${expectedRevision}::integer IS NULL OR analysis_revision + 1 = ${expectedRevision})
          AND NOT EXISTS (
            SELECT 1
            FROM alfaclub.inverse_opinion_trade_journal_revision_audit AS unresolved
            WHERE unresolved.dispatch_id = inverse_opinion_trade_journal_dispatch.dispatch_id
              AND unresolved.audit_state IN ('requested', 'send_unknown')
          )
        RETURNING dispatch_id, analysis_revision
      ), audited AS (
        INSERT INTO alfaclub.inverse_opinion_trade_journal_revision_audit (
          dispatch_id,
          revision,
          operator_address,
          audit_state,
          content_hash,
          client_message_id,
          journal_marker,
          public_text,
          claimant_token,
          lease_expires_at
        )
        SELECT
          dispatch_id,
          analysis_revision,
          ${operatorAddress},
          'requested',
          NULL,
          ${clientMessageIdPrefix} || ':' || analysis_revision::text,
          'inverse-akita-trade-journal:v1',
          ${publicText},
          ${claimantToken}::uuid,
          NOW() + (${leaseSeconds} * INTERVAL '1 second')
        FROM bumped
        RETURNING
          revision,
          client_message_id,
          public_text,
          claimant_token::text AS claimant_token
      )
      SELECT
        revision,
        client_message_id,
        public_text,
        claimant_token,
        FALSE AS recovered,
        FALSE AS blocked
      FROM audited;
    `
    const revision = Number(result.rows?.[0]?.revision)
    const clientMessageId = String(result.rows?.[0]?.client_message_id ?? '')
    const storedText = result.rows?.[0]?.public_text
    const storedClaimant = result.rows?.[0]?.claimant_token
    if (
      !Number.isInteger(revision)
      || revision <= 0
      || !storedText
      || !storedClaimant
    ) {
      throw new OpinionTradeStoreError('journal_parent_missing')
    }
    return {
      revision,
      clientMessageId,
      publicText: storedText,
      claimantToken: storedClaimant,
      recovered: false,
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('begin_journal_revision', error)
  }
}

export async function markOpinionTradeJournalRevisionSending(params: {
  windowStart: string
  windowEnd: string
  revision: number
  claimantToken: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const revision = Math.floor(params.revision)
  const claimantToken = requiredText(params.claimantToken, 64)
  if (
    !windowStart
    || !windowEnd
    || !Number.isInteger(revision)
    || revision <= 0
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
      SET send_started_at = COALESCE(send_started_at, NOW())
      FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      WHERE audit.dispatch_id = dispatch.dispatch_id
        AND dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
        AND audit.revision = ${revision}
        AND audit.audit_state = 'requested'
        AND audit.claimant_token = ${claimantToken}::uuid
        AND audit.lease_expires_at > NOW()
      RETURNING audit.audit_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('journal_revision_not_owned')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('mark_journal_revision_sending', error)
  }
}

export async function resolveOpinionTradeJournalRevisionSendUnknown(params: {
  windowStart: string
  windowEnd: string
  revision: number
  operatorAddress: string
  resolution: 'mark_sent' | 'mark_failed'
  knownMessageId?: string | null
  knownContentHash?: string | null
  note: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const revision = Math.floor(params.revision)
  const operatorAddress = normalizeWallet(params.operatorAddress)
  const knownMessageId =
    params.knownMessageId == null ? null : requiredText(params.knownMessageId, 256)
  const knownContentHash =
    params.knownContentHash == null ? null : requiredText(params.knownContentHash, 64)
  const note = requiredText(params.note, 500)
  if (
    !windowStart
    || !windowEnd
    || !Number.isInteger(revision)
    || revision <= 0
    || !operatorAddress
    || !['mark_sent', 'mark_failed'].includes(params.resolution)
    || !note
    || note.length < 8
    || (
      params.resolution === 'mark_sent'
      && (!knownMessageId || !/^[a-f0-9]{64}$/.test(knownContentHash ?? ''))
    )
    || (
      params.resolution === 'mark_failed'
      && (knownMessageId != null || knownContentHash != null)
    )
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const state = params.resolution === 'mark_sent' ? 'sent' : 'failed'
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
      SET audit_state = ${state},
          reply_message_id = CASE
            WHEN ${params.resolution} = 'mark_sent' THEN ${knownMessageId}
            ELSE NULL
          END,
          content_hash = CASE
            WHEN ${params.resolution} = 'mark_sent' THEN ${knownContentHash}
            ELSE NULL
          END,
          last_error_code = CASE
            WHEN ${params.resolution} = 'mark_failed' THEN 'operator_confirmed_absent'
            ELSE NULL
          END,
          resolution_operator_address = ${operatorAddress},
          resolution_note = ${note},
          resolved_at = NOW()
      FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      WHERE audit.dispatch_id = dispatch.dispatch_id
        AND dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
        AND audit.revision = ${revision}
        AND audit.audit_state = 'send_unknown'
      RETURNING audit.audit_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('send_unknown_resolution_conflict')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('resolve_journal_revision_send_unknown', error)
  }
}

export async function recoverOpinionTradeJournalRevisionSendUnknown(params: {
  windowStart: string
  windowEnd: string
  revision: number
  claimantToken: string
  replyMessageId: string
  contentHash: string
  errorCode: string
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const revision = Math.floor(params.revision)
  const claimantToken = requiredText(params.claimantToken, 64)
  const replyMessageId = requiredText(params.replyMessageId, 256)
  const contentHash = requiredText(params.contentHash, 64)
  const errorCode = requiredText(params.errorCode, 128)
  if (
    !windowStart
    || !windowEnd
    || !Number.isInteger(revision)
    || revision <= 0
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || !replyMessageId
    || !/^[a-f0-9]{64}$/.test(contentHash ?? '')
    || !errorCode
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
      SET audit_state = 'send_unknown',
          reply_message_id = ${replyMessageId},
          content_hash = ${contentHash},
          last_error_code = ${errorCode}
      FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      WHERE audit.dispatch_id = dispatch.dispatch_id
        AND dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
        AND audit.revision = ${revision}
        AND audit.audit_state = 'requested'
        AND audit.claimant_token = ${claimantToken}::uuid
      RETURNING audit.audit_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('journal_revision_not_pending')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('recover_journal_revision_send_unknown', error)
  }
}

export async function completeOpinionTradeJournalRevision(params: {
  windowStart: string
  windowEnd: string
  revision: number
  claimantToken: string
  state: 'sent' | 'failed' | 'send_unknown'
  replyMessageId?: string | null
  contentHash?: string | null
}): Promise<void> {
  const windowStart = validIsoTimestamp(params.windowStart)
  const windowEnd = validIsoTimestamp(params.windowEnd)
  const revision = Math.floor(params.revision)
  const claimantToken = requiredText(params.claimantToken, 64)
  const replyMessageId =
    params.replyMessageId == null ? null : requiredText(params.replyMessageId, 256)
  const contentHash = params.contentHash == null ? null : requiredText(params.contentHash, 64)
  if (
    !windowStart
    || !windowEnd
    || !Number.isInteger(revision)
    || revision <= 0
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || !['sent', 'failed', 'send_unknown'].includes(params.state)
    || (params.state === 'sent' && (!replyMessageId || !/^[a-f0-9]{64}$/.test(contentHash ?? '')))
  ) {
    throw new OpinionTradeStoreError('invalid_input')
  }
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_trade_journal_revision_audit AS audit
      SET
        audit_state = ${params.state},
        reply_message_id = ${replyMessageId},
        content_hash = ${contentHash}
      FROM alfaclub.inverse_opinion_trade_journal_dispatch AS dispatch
      WHERE audit.dispatch_id = dispatch.dispatch_id
        AND dispatch.room_id = '1659'
        AND dispatch.reporting_window_start = ${windowStart}::timestamptz
        AND dispatch.reporting_window_end = ${windowEnd}::timestamptz
        AND audit.revision = ${revision}
        AND audit.audit_state = 'requested'
        AND audit.claimant_token = ${claimantToken}::uuid
      RETURNING audit.audit_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('journal_revision_not_pending')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('complete_journal_revision', error)
  }
}

type TerminalReplyDecisionRow = {
  decision_id: string
  room_id: string
  source_message_id: string
  terminal_outcome: DecisionTerminalOutcome
  reason_code: string | null
  receipt_summary: Record<string, unknown> | null
}

function mapTerminalReplyDecision(row: TerminalReplyDecisionRow): TerminalReplyDecision {
  return {
    decisionId: row.decision_id,
    roomId: row.room_id,
    sourceMessageId: row.source_message_id,
    terminalOutcome: row.terminal_outcome,
    reasonCode: row.reason_code,
    receiptSummary: objectValue(row.receipt_summary),
  }
}

/**
 * Finds durable terminal decisions that still need an outbox payload. Source
 * excerpts and sender identity are intentionally excluded from this query.
 */
export async function listTerminalDecisionsMissingReplyDelivery(params?: {
  decisionId?: string
  limit?: number
}): Promise<TerminalReplyDecision[]> {
  const decisionId = params?.decisionId == null
    ? null
    : requiredText(params.decisionId, 64)
  const limit = Math.min(200, Math.max(1, Math.floor(params?.limit ?? 100)))
  if (params?.decisionId != null && !decisionId) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<TerminalReplyDecisionRow>`
      SELECT
        d.decision_id::text AS decision_id,
        source.room_id,
        source.message_id AS source_message_id,
        d.terminal_outcome,
        d.reason_code,
        d.receipt_summary
      FROM alfaclub.inverse_opinion_trade_decisions AS d
      JOIN alfaclub.inverse_opinion_source_messages AS source
        ON source.source_message_id = d.source_message_id
      WHERE d.execution_phase = 'resolved'
        AND d.terminal_outcome IS NOT NULL
        AND (${decisionId}::uuid IS NULL OR d.decision_id = ${decisionId}::uuid)
        AND (
          NOT EXISTS (
            SELECT 1
            FROM alfaclub.inverse_opinion_reply_deliveries AS delivery
            WHERE delivery.decision_id = d.decision_id
              AND delivery.delivery_kind = 'result'
          )
          OR (
            jsonb_typeof(d.receipt_summary #> '{terminalReply}') = 'object'
            AND length(btrim(d.receipt_summary #>> '{terminalReply,threadReceiptText}')) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM alfaclub.inverse_opinion_reply_deliveries AS delivery
              WHERE delivery.decision_id = d.decision_id
                AND delivery.delivery_kind = 'receipt'
            )
          )
        )
      ORDER BY d.resolved_at ASC, d.decision_id ASC
      LIMIT ${limit};
    `
    return result.rows.map(mapTerminalReplyDecision)
  } catch (error) {
    throw storeFailure('list_missing_terminal_reply_delivery', error, 'db_read_failed')
  }
}

export async function ensureTerminalReplyDeliveries(params: {
  decisionId: string
  deliveries: Array<{
    kind: TerminalReplyDeliveryKind
    publicText: string
    clientMessageId: string
  }>
}): Promise<TerminalReplyDeliveryKind[]> {
  const decisionId = requiredText(params.decisionId, 64)
  if (
    !decisionId
    || params.deliveries.length < 1
    || params.deliveries.length > 2
    || params.deliveries.some((delivery) => (
      !['result', 'receipt'].includes(delivery.kind)
      || !requiredText(delivery.publicText, 2_000)
      || !requiredText(delivery.clientMessageId, 160)
    ))
  ) throw new OpinionTradeStoreError('invalid_input')

  await getReadyDb()
  try {
    const created = await runInTransaction(async (tx) => {
      const created: TerminalReplyDeliveryKind[] = []
      for (const delivery of params.deliveries) {
        const result = await tx.sql<{ delivery_kind: TerminalReplyDeliveryKind }>`
          INSERT INTO alfaclub.inverse_opinion_reply_deliveries (
            decision_id,
            delivery_kind,
            public_text,
            client_message_id
          )
          SELECT
            decision_id,
            ${delivery.kind},
            ${delivery.publicText.trim()},
            ${delivery.clientMessageId.trim()}
          FROM alfaclub.inverse_opinion_trade_decisions
          WHERE decision_id = ${decisionId}::uuid
            AND execution_phase = 'resolved'
            AND terminal_outcome IS NOT NULL
          ON CONFLICT (decision_id, delivery_kind) DO UPDATE
          SET updated_at = alfaclub.inverse_opinion_reply_deliveries.updated_at
          WHERE alfaclub.inverse_opinion_reply_deliveries.public_text = EXCLUDED.public_text
            AND alfaclub.inverse_opinion_reply_deliveries.client_message_id =
              EXCLUDED.client_message_id
          RETURNING delivery_kind;
        `
        if (!result.rows[0]) {
          throw new OpinionTradeStoreError('delivery_payload_conflict')
        }
        created.push(result.rows[0].delivery_kind)
      }
      return created
    })
    if (!created) throw new OpinionTradeStoreError('db_unavailable')
    return created
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('ensure_terminal_reply_delivery', error)
  }
}

export async function claimTerminalReplyDeliveries(params?: {
  decisionId?: string
  limit?: number
  leaseSeconds?: number
  states?: Array<'pending' | 'failed' | 'expired_sending'>
}): Promise<ClaimedTerminalReplyDelivery[]> {
  const decisionId = params?.decisionId == null
    ? null
    : requiredText(params.decisionId, 64)
  const limit = Math.min(50, Math.max(1, Math.floor(params?.limit ?? 20)))
  const leaseSeconds = Math.min(300, Math.max(30, Math.floor(params?.leaseSeconds ?? 90)))
  const claimantToken = randomUUID()
  if (
    (params?.decisionId != null && !decisionId)
    || (
      params?.states != null
      && (
        params.states.length !== 3
        || !['pending', 'failed', 'expired_sending'].every((state) => params.states!.includes(
          state as 'pending' | 'failed' | 'expired_sending',
        ))
      )
    )
  ) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql<{
      decision_id: string
      delivery_kind: TerminalReplyDeliveryKind
      room_id: string
      source_message_id: string
      public_text: string
      client_message_id: string
      claimant_token: string
    }>`
      WITH candidates AS (
        SELECT delivery.decision_id, delivery.delivery_kind
        FROM alfaclub.inverse_opinion_reply_deliveries AS delivery
        WHERE (${decisionId}::uuid IS NULL OR delivery.decision_id = ${decisionId}::uuid)
          AND delivery.attempt_count < 10
          AND (
            delivery.delivery_state = 'pending'
            OR (
              delivery.delivery_state = 'failed'
              AND delivery.updated_at <= NOW() - INTERVAL '30 seconds'
            )
            OR (
              delivery.delivery_state = 'sending'
              AND delivery.lease_expires_at <= NOW()
            )
          )
          AND (
            delivery.delivery_kind = 'result'
            OR EXISTS (
              SELECT 1
              FROM alfaclub.inverse_opinion_reply_deliveries AS result_delivery
              WHERE result_delivery.decision_id = delivery.decision_id
                AND result_delivery.delivery_kind = 'result'
                AND result_delivery.delivery_state = 'sent'
            )
          )
        ORDER BY
          CASE delivery.delivery_kind WHEN 'result' THEN 0 ELSE 1 END,
          delivery.updated_at ASC,
          delivery.decision_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      ),
      claimed AS (
        UPDATE alfaclub.inverse_opinion_reply_deliveries AS delivery
        SET delivery_state = 'sending',
            claimant_token = ${claimantToken}::uuid,
            lease_expires_at = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
            attempt_count = delivery.attempt_count + 1,
            send_started_at = NOW(),
            last_error_code = NULL,
            updated_at = NOW()
        FROM candidates
        WHERE delivery.decision_id = candidates.decision_id
          AND delivery.delivery_kind = candidates.delivery_kind
        RETURNING delivery.*
      )
      SELECT
        claimed.decision_id::text AS decision_id,
        claimed.delivery_kind,
        source.room_id,
        source.message_id AS source_message_id,
        claimed.public_text,
        claimed.client_message_id,
        claimed.claimant_token::text AS claimant_token
      FROM claimed
      JOIN alfaclub.inverse_opinion_trade_decisions AS decision
        ON decision.decision_id = claimed.decision_id
      JOIN alfaclub.inverse_opinion_source_messages AS source
        ON source.source_message_id = decision.source_message_id
      ORDER BY CASE claimed.delivery_kind WHEN 'result' THEN 0 ELSE 1 END;
    `
    return result.rows.map((row) => ({
      decisionId: row.decision_id,
      deliveryKind: row.delivery_kind,
      roomId: row.room_id,
      sourceMessageId: row.source_message_id,
      publicText: row.public_text,
      clientMessageId: row.client_message_id,
      claimantToken: row.claimant_token,
    }))
  } catch (error) {
    throw storeFailure('claim_terminal_reply_delivery', error)
  }
}

async function completeTerminalReplyDelivery(params: {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  claimantToken: string
  state: 'sent' | 'failed' | 'send_unknown'
  messageId?: string | null
  errorCode?: string | null
}): Promise<void> {
  const decisionId = requiredText(params.decisionId, 64)
  const claimantToken = requiredText(params.claimantToken, 64)
  const messageId = params.messageId == null ? null : requiredText(params.messageId, 256)
  const errorCode = params.errorCode == null ? null : requiredText(params.errorCode, 128)
  if (
    !decisionId
    || !['result', 'receipt'].includes(params.deliveryKind)
    || !/^[a-f0-9-]{36}$/i.test(claimantToken ?? '')
    || (params.state === 'sent' && !messageId)
    || (params.state !== 'sent' && !errorCode)
  ) throw new OpinionTradeStoreError('invalid_input')
  const db = await getReadyDb()
  try {
    const result = await db.sql`
      UPDATE alfaclub.inverse_opinion_reply_deliveries
      SET delivery_state = ${params.state},
          message_id = ${messageId},
          last_error_code = ${errorCode},
          sent_at = CASE WHEN ${params.state} = 'sent' THEN NOW() ELSE NULL END,
          claimant_token = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE decision_id = ${decisionId}::uuid
        AND delivery_kind = ${params.deliveryKind}
        AND delivery_state = 'sending'
        AND claimant_token = ${claimantToken}::uuid
      RETURNING decision_id;
    `
    if ((result.rows?.length ?? 0) !== 1) {
      throw new OpinionTradeStoreError('delivery_claim_lost')
    }
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure(`mark_terminal_reply_delivery_${params.state}`, error)
  }
}

export async function markTerminalReplyDeliverySent(params: {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  claimantToken: string
  messageId: string
}): Promise<void> {
  return completeTerminalReplyDelivery({ ...params, state: 'sent' })
}

export async function markTerminalReplyDeliveryFailed(params: {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  claimantToken: string
  errorCode: string
}): Promise<void> {
  return completeTerminalReplyDelivery({ ...params, state: 'failed' })
}

export async function markTerminalReplyDeliveryUnknown(params: {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  claimantToken: string
  errorCode: string
}): Promise<void> {
  return completeTerminalReplyDelivery({ ...params, state: 'send_unknown' })
}

export type TerminalReplyDeliveryResolution = {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  priorState: 'send_unknown'
  resultingState: 'sent' | 'failed'
  messageId: string | null
}

export async function resolveTerminalReplyDeliverySendUnknown(params: {
  decisionId: string
  deliveryKind: TerminalReplyDeliveryKind
  operatorAddress: string
  resolution: 'mark_sent' | 'mark_failed'
  knownMessageId?: string | null
  note: string
}): Promise<TerminalReplyDeliveryResolution> {
  const decisionId = requiredText(params.decisionId, 64)
  const operatorAddress = normalizeWallet(params.operatorAddress)
  const knownMessageId =
    params.knownMessageId == null ? null : requiredText(params.knownMessageId, 256)
  const note = requiredText(params.note, 500)
  if (
    !decisionId
    || !/^[a-f0-9-]{36}$/i.test(decisionId)
    || !['result', 'receipt'].includes(params.deliveryKind)
    || !operatorAddress
    || !['mark_sent', 'mark_failed'].includes(params.resolution)
    || !note
    || note.length < 8
    || (params.resolution === 'mark_sent' && !knownMessageId)
    || (params.resolution === 'mark_failed' && knownMessageId != null)
  ) throw new OpinionTradeStoreError('invalid_input')

  const resultingState = params.resolution === 'mark_sent' ? 'sent' : 'failed'
  await getReadyDb()
  try {
    const result = await runInTransaction(async (tx) => {
      const resolved = await tx.sql<{
        decision_id: string
        delivery_kind: TerminalReplyDeliveryKind
        prior_state: 'send_unknown'
        resulting_state: 'sent' | 'failed'
        message_id: string | null
      }>`
        UPDATE alfaclub.inverse_opinion_reply_deliveries
        SET delivery_state = ${resultingState},
            message_id = ${knownMessageId},
            sent_at = CASE WHEN ${resultingState} = 'sent' THEN NOW() ELSE NULL END,
            last_error_code = CASE
              WHEN ${resultingState} = 'failed' THEN 'operator_confirmed_absent'
              ELSE NULL
            END,
            claimant_token = NULL,
            lease_expires_at = NULL,
            updated_at = NOW()
        WHERE decision_id = ${decisionId}::uuid
          AND delivery_kind = ${params.deliveryKind}
          AND delivery_state = 'send_unknown'
        RETURNING
          decision_id::text AS decision_id,
          delivery_kind,
          'send_unknown'::text AS prior_state,
          delivery_state AS resulting_state,
          message_id;
      `
      const row = resolved.rows[0]
      if (!row) {
        throw new OpinionTradeStoreError('terminal_reply_send_unknown_resolution_conflict')
      }
      await tx.sql`
        INSERT INTO alfaclub.inverse_opinion_reply_delivery_resolution_audit (
          decision_id,
          delivery_kind,
          operator_address,
          resolution,
          known_message_id,
          operator_note,
          prior_state,
          resulting_state
        )
        VALUES (
          ${decisionId}::uuid,
          ${params.deliveryKind},
          ${operatorAddress},
          ${params.resolution},
          ${knownMessageId},
          ${note},
          ${row.prior_state},
          ${row.resulting_state}
        );
      `
      return {
        decisionId: row.decision_id,
        deliveryKind: row.delivery_kind,
        priorState: row.prior_state,
        resultingState: row.resulting_state,
        messageId: row.message_id,
      }
    })
    if (!result) throw new OpinionTradeStoreError('db_unavailable')
    return result
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('resolve_terminal_reply_send_unknown', error)
  }
}

export async function readTerminalReplyDeliveryBacklog(): Promise<TerminalReplyDeliveryBacklog> {
  const db = await getReadyDb()
  try {
    const result = await db.sql<{
      pending: number | string
      sending: number | string
      failed: number | string
      send_unknown: number | string
      last_success_at: string | null
    }>`
      SELECT
        count(*) FILTER (WHERE delivery_state = 'pending') AS pending,
        count(*) FILTER (WHERE delivery_state = 'sending') AS sending,
        count(*) FILTER (WHERE delivery_state = 'failed') AS failed,
        count(*) FILTER (WHERE delivery_state = 'send_unknown') AS send_unknown,
        max(sent_at)::text AS last_success_at
      FROM alfaclub.inverse_opinion_reply_deliveries;
    `
    const row = result.rows[0]
    return {
      pending: Number(row?.pending ?? 0),
      sending: Number(row?.sending ?? 0),
      failed: Number(row?.failed ?? 0),
      sendUnknown: Number(row?.send_unknown ?? 0),
      lastSuccessAt: row?.last_success_at ?? null,
    }
  } catch (error) {
    throw storeFailure('read_terminal_reply_delivery_backlog', error, 'db_read_failed')
  }
}
