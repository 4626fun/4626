import { getDb, type DbPool } from '../db/postgres.js'
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
  updatedAt: string
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
  updated_at: string
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
    updatedAt: row.updated_at,
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
  if (from === to) return to === 'resolved' ? outcome !== null : outcome === null
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
  if (from === 'pending') return to === 'partial' || to === 'open'
  if (from === 'partial') return to === 'open' || to === 'ambiguous'
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
        source_timestamp,
        NOW()
      FROM source_message
      ON CONFLICT (source_message_id, intent_ordinal, normalized_market) DO UPDATE
      SET decision_id = alfaclub.inverse_opinion_trade_decisions.decision_id
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
        updated_at::text AS updated_at;
    `
    const row = result.rows?.[0]
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
  requestedParameters?: Record<string, unknown>
  receiptSummary?: Record<string, unknown>
}): Promise<OpinionTradeDecision> {
  const decisionId = requiredText(params.decisionId, 64)
  const terminalOutcome = params.terminalOutcome ?? null
  const executorWallet =
    params.executorWallet == null ? null : normalizeWallet(params.executorWallet)
  const reasonCode =
    params.reasonCode == null ? null : requiredText(params.reasonCode, 128)
  if (
    !decisionId
    || !isValidTransitionTarget(params.executionPhase, terminalOutcome)
    || (params.executorWallet != null && !executorWallet)
    || (params.reasonCode != null && !reasonCode)
  ) {
    throw new OpinionTradeStoreError('invalid_transition')
  }

  const db = await getReadyDb()
  try {
    const result = await db.sql<DecisionRow>`
      UPDATE alfaclub.inverse_opinion_trade_decisions
      SET execution_phase = ${params.executionPhase},
          terminal_outcome = ${terminalOutcome},
          reason_code = ${reasonCode},
          executor_wallet = COALESCE(${executorWallet}, executor_wallet),
          requested_parameters = COALESCE(
            ${params.requestedParameters == null ? null : JSON.stringify(params.requestedParameters)}::jsonb,
            requested_parameters
          ),
          receipt_summary = COALESCE(
            ${params.receiptSummary == null ? null : JSON.stringify(params.receiptSummary)}::jsonb,
            receipt_summary
          ),
          submitted_at = CASE
            WHEN ${params.executionPhase} = 'submitted' THEN COALESCE(submitted_at, NOW())
            ELSE submitted_at
          END,
          resolved_at = CASE
            WHEN ${params.executionPhase} = 'resolved' THEN COALESCE(resolved_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
      WHERE decision_id = ${decisionId}::uuid
        AND (
          (
            execution_phase = ${params.executionPhase}
            AND terminal_outcome IS NOT DISTINCT FROM ${terminalOutcome}
          )
          OR (execution_phase = 'observed' AND ${params.executionPhase} = 'claimed' AND ${terminalOutcome} IS NULL)
          OR (execution_phase = 'claimed' AND ${params.executionPhase} = 'submitted' AND ${terminalOutcome} IS NULL)
          OR (
            execution_phase = 'claimed'
            AND ${params.executionPhase} = 'resolved'
            AND ${terminalOutcome} IN ('rejected', 'blocked')
          )
          OR (
            execution_phase = 'submitted'
            AND ${params.executionPhase} = 'resolved'
            AND ${terminalOutcome} IN ('executed', 'failed')
          )
          OR (execution_phase = 'submitted' AND ${params.executionPhase} = 'unknown' AND ${terminalOutcome} IS NULL)
          OR (
            execution_phase = 'unknown'
            AND ${params.executionPhase} = 'resolved'
            AND ${terminalOutcome} IN ('executed', 'failed', 'incomplete')
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
        updated_at::text AS updated_at;
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
  reconciliationGeneration: number
  currentSnapshot?: Record<string, unknown>
  realizedResult?: Record<string, unknown>
  reconciledAt: string
  closedAt?: string | null
}): Promise<PositionLifecycle> {
  const lifecycleId = requiredText(params.lifecycleId, 64)
  const reconciliationGeneration = Number(params.reconciliationGeneration)
  const reconciledAt = validIsoTimestamp(params.reconciledAt)
  const closedAt = params.closedAt == null ? null : validIsoTimestamp(params.closedAt)
  const terminal =
    params.lifecycleState === 'closed' || params.lifecycleState === 'incomplete'
  if (
    !lifecycleId
    || !Number.isInteger(reconciliationGeneration)
    || reconciliationGeneration < 0
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
          reconciliation_generation = ${reconciliationGeneration},
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
        AND reconciliation_generation <= ${reconciliationGeneration}
        AND (
          lifecycle_state = ${params.lifecycleState}
          OR (lifecycle_state = 'pending' AND ${params.lifecycleState} IN ('partial', 'open'))
          OR (lifecycle_state = 'partial' AND ${params.lifecycleState} IN ('open', 'ambiguous'))
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
    if (!row) throw new OpinionTradeStoreError('invalid_transition')
    return mapLifecycle(row)
  } catch (error) {
    if (error instanceof OpinionTradeStoreError) throw error
    throw storeFailure('transition_lifecycle', error)
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
