import crypto from 'node:crypto'
import { getDb, isDbConfigured, runInTransaction } from '../../../packages/server-core/src/index.js'
import { emitControlPlaneMetric } from './metrics.js'

type Db = {
  sql: <T = any>(
    strings: TemplateStringsArray,
    ...values: any[]
  ) => Promise<{ rows?: T[]; rowCount?: number }>
}

export type OperationStatus =
  | 'requested'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'retrying'
  | 'manual_review'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired'

export type StageStatus = OperationStatus

const NON_TERMINAL_OPERATION_STATUSES = new Set<OperationStatus>([
  'requested',
  'queued',
  'running',
  'blocked',
  'retrying',
  'manual_review',
])

const OPERATION_TRANSITIONS: Record<OperationStatus, Set<OperationStatus>> = {
  requested: new Set(['queued', 'running', 'blocked', 'manual_review', 'failed', 'cancelled']),
  queued: new Set(['running', 'blocked', 'retrying', 'failed', 'cancelled', 'expired']),
  running: new Set(['retrying', 'blocked', 'manual_review', 'succeeded', 'failed']),
  retrying: new Set(['queued', 'running', 'failed', 'expired']),
  blocked: new Set(['queued', 'running', 'manual_review', 'cancelled', 'failed']),
  manual_review: new Set(['queued', 'running', 'cancelled', 'failed']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  expired: new Set(),
}

const STAGE_TRANSITIONS: Record<StageStatus, Set<StageStatus>> = {
  ...OPERATION_TRANSITIONS,
}

export type StartControlPlaneOperationInput = {
  operationKind: string
  vaultAddress?: string | null
  scopeType?: string | null
  scopeId?: string | null
  lockScope?: string | null
  lockKey?: string | null
  requestedBy?: string | null
  idempotencyKey?: string | null
  schemaVersion?: string | null
  input?: Record<string, unknown> | null
  policyVersion?: string | null
}

export type CompleteControlPlaneOperationInput = {
  operationId: string
  status: Exclude<OperationStatus, 'requested' | 'queued' | 'running' | 'blocked' | 'retrying' | 'manual_review'>
  result?: Record<string, unknown> | null
  errorCode?: string | null
  errorMessage?: string | null
  actor?: string | null
}

export type CreateOperationStageInput = {
  operationId: string
  stageKind: string
  status?: StageStatus
  input?: Record<string, unknown> | null
}

export type TransitionOperationStatusInput = {
  operationId: string
  nextStatus: OperationStatus
  reason: string
  actor?: string | null
  data?: Record<string, unknown> | null
  errorCode?: string | null
  errorMessage?: string | null
  result?: Record<string, unknown> | null
}

export type TransitionStageStatusInput = {
  stageId: string
  nextStatus: StageStatus
  reason: string
  actor?: string | null
  data?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
  errorCode?: string | null
  errorMessage?: string | null
}

export class ControlPlaneOperationError extends Error {
  code: string
  statusCode: number

  constructor(params: { code: string; message: string; statusCode?: number }) {
    super(params.message)
    this.code = params.code
    this.statusCode = params.statusCode ?? 409
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

function nowSlug(): string {
  return Date.now().toString(36)
}

function normalizeToken(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, '_')
  return normalized || fallback
}

function normalizeVaultAddress(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = String(value).trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(normalized) ? normalized : null
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const child = record[key]
        if (child !== undefined) acc[key] = canonicalize(child)
        return acc
      }, {})
  }
  return value
}

function hashCanonical(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (!value || typeof value !== 'object') return value
  const input = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(input)) {
    if (/private.?key|api.?key|bearer|token|secret|authorization|card|cvv|payment_method/i.test(key)) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = redactSensitive(child)
  }
  return out
}

export function createOperationId(kind: string, subject?: string): string {
  const normalizedKind = normalizeToken(kind || 'op', 'op')
  const subjectSlug = subject ? subject.replace(/^0x/, '').slice(0, 8).toLowerCase() : 'global'
  return `${normalizedKind}_${subjectSlug}_${nowSlug()}_${randomSuffix()}`
}

function createStageId(stageKind: string): string {
  return `stage_${normalizeToken(stageKind || 'stage', 'stage')}_${nowSlug()}_${randomSuffix()}`
}

async function getDbSafe(): Promise<Db | null> {
  if (!isDbConfigured()) return null
  const db = await getDb()
  return (db as Db | null) ?? null
}

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /(control_plane_operations|control_plane_stages|control_plane_events)/i.test(message) &&
    (/does not exist/i.test(message) || /relation/i.test(message))
}

let warnedMissingTable = false

async function safeInsertEvent(params: {
  db: Db
  operationId: string
  stageId?: string | null
  eventType: string
  message: string
  data?: Record<string, unknown> | null
}): Promise<void> {
  const dataJson = JSON.stringify(redactSensitive(params.data ?? {}))
  await params.db.sql`
    INSERT INTO public.control_plane_events (
      operation_id,
      stage_id,
      event_type,
      message,
      data_json
    ) VALUES (
      ${params.operationId},
      ${params.stageId ?? null},
      ${params.eventType},
      ${params.message},
      ${dataJson}::jsonb
    );
  `
}

export async function addControlPlaneEvent(params: {
  operationId: string
  stageId?: string | null
  eventType: string
  message: string
  data?: Record<string, unknown> | null
}): Promise<void> {
  const db = await getDbSafe()
  if (!db) return
  try {
    await safeInsertEvent({ db, ...params })
  } catch (error) {
    if (isMissingTableError(error)) return
    console.warn('[control-plane/operations] Failed to persist event', {
      operationId: params.operationId,
      eventType: params.eventType,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function startControlPlaneOperation(
  input: StartControlPlaneOperationInput,
): Promise<{ operationId: string; persisted: boolean; reused: boolean }> {
  const vaultAddress = normalizeVaultAddress(input.vaultAddress)
  const scopeType = normalizeToken(input.scopeType ?? (vaultAddress ? 'vault' : 'global'), 'global')
  const scopeId = String(input.scopeId ?? vaultAddress ?? 'global').trim().toLowerCase()
  const operationKind = normalizeToken(input.operationKind, 'operation.unknown')
  const operationId = createOperationId(operationKind, vaultAddress ?? scopeId)
  const db = await getDbSafe()
  if (!db) return { operationId, persisted: false, reused: false }

  const requestedBy = String(input.requestedBy ?? '').trim() || null
  const idempotencyKey = String(input.idempotencyKey ?? '').trim() || null
  const lockScope = normalizeToken(input.lockScope ?? operationKind, operationKind)
  const lockKey = String(input.lockKey ?? `${scopeType}:${scopeId}`).trim().toLowerCase()
  const schemaVersion = String(input.schemaVersion ?? 'v1').trim() || 'v1'
  const policyVersion = String(input.policyVersion ?? '').trim() || null
  const canonicalInput = canonicalize(input.input ?? {}) as Record<string, unknown>
  const inputJson = JSON.stringify(canonicalInput)
  const inputHash = hashCanonical(canonicalInput)
  const idempotencyFingerprint = `${operationKind}:${scopeType}:${scopeId}:${idempotencyKey ?? ''}:${schemaVersion}:${inputHash}`

  try {
    if (idempotencyKey) {
      const existing = await db.sql<{
        operation_id: string
        input_hash: string | null
      }>`
        SELECT operation_id, input_hash
        FROM public.control_plane_operations
        WHERE operation_kind = ${operationKind}
          AND scope_type = ${scopeType}
          AND scope_id = ${scopeId}
          AND idempotency_key = ${idempotencyKey}
        ORDER BY created_at DESC
        LIMIT 1;
      `
      const prior = existing.rows?.[0]
      if (prior?.operation_id) {
        if (prior.input_hash && prior.input_hash !== inputHash) {
          throw new ControlPlaneOperationError({
            code: 'idempotency_payload_mismatch',
            message: 'Idempotency key already used with different payload',
          })
        }
        return { operationId: String(prior.operation_id), persisted: true, reused: true }
      }
    }

    await db.sql`
      INSERT INTO public.control_plane_operations (
        operation_id,
        operation_kind,
        scope_type,
        scope_id,
        lock_scope,
        lock_key,
        vault_address,
        status,
        requested_by,
        idempotency_key,
        schema_version,
        input_hash,
        idempotency_fingerprint,
        policy_version,
        input_json
      )
      VALUES (
        ${operationId},
        ${operationKind},
        ${scopeType},
        ${scopeId},
        ${lockScope},
        ${lockKey},
        ${vaultAddress},
        'requested',
        ${requestedBy},
        ${idempotencyKey},
        ${schemaVersion},
        ${inputHash},
        ${idempotencyFingerprint},
        ${policyVersion},
        ${inputJson}::jsonb
      );
    `
    await safeInsertEvent({
      db,
      operationId,
      eventType: 'operation.status_transition',
      message: 'Operation requested',
      data: {
        previousStatus: null,
        nextStatus: 'requested',
        reason: 'operation_requested',
        actor: requestedBy ?? 'system',
        policyVersion: policyVersion ?? null,
      },
    })
    emitControlPlaneMetric({
      metric: 'control_plane.operation.status',
      operationKind,
      status: 'requested',
      operationId,
      scopeId,
      idempotencyKey,
    })
    return { operationId, persisted: true, reused: false }
  } catch (error) {
    if (error instanceof ControlPlaneOperationError) throw error
    if (isMissingTableError(error) && !warnedMissingTable) {
      warnedMissingTable = true
      console.warn('[control-plane/operations] control-plane tables missing; tracking disabled until migration is applied')
      return { operationId, persisted: false, reused: false }
    }
    console.warn('[control-plane/operations] Failed to persist operation start', {
      operationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { operationId, persisted: false, reused: false }
  }
}

export async function createControlPlaneStage(input: CreateOperationStageInput): Promise<{ stageId: string; persisted: boolean }> {
  const db = await getDbSafe()
  if (!db) return { stageId: createStageId(input.stageKind), persisted: false }
  const stageId = createStageId(input.stageKind)
  const stageStatus = input.status ?? 'requested'
  const inputJson = JSON.stringify(canonicalize(input.input ?? {}))
  try {
    await db.sql`
      INSERT INTO public.control_plane_stages (
        stage_id,
        operation_id,
        stage_kind,
        status,
        attempt_count,
        input_json
      ) VALUES (
        ${stageId},
        ${input.operationId},
        ${normalizeToken(input.stageKind, 'operation.stage')},
        ${stageStatus},
        0,
        ${inputJson}::jsonb
      );
    `
    await safeInsertEvent({
      db,
      operationId: input.operationId,
      stageId,
      eventType: 'stage.status_transition',
      message: 'Stage created',
      data: {
        previousStatus: null,
        nextStatus: stageStatus,
        reason: 'stage_created',
        actor: 'system',
      },
    })
    emitControlPlaneMetric({
      metric: 'control_plane.stage.status',
      status: stageStatus,
      stageKind: normalizeToken(input.stageKind, 'operation.stage'),
      operationId: input.operationId,
      stageId,
    })
    return { stageId, persisted: true }
  } catch (error) {
    if (isMissingTableError(error)) return { stageId, persisted: false }
    console.warn('[control-plane/operations] Failed to persist stage create', {
      operationId: input.operationId,
      stageId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { stageId, persisted: false }
  }
}

export async function transitionOperationStatus(input: TransitionOperationStatusInput): Promise<void> {
  const db = await getDbSafe()
  if (!db) return
  try {
    const rows = await db.sql<{ status: OperationStatus; policy_version: string | null }>`
      SELECT status, policy_version
      FROM public.control_plane_operations
      WHERE operation_id = ${input.operationId}
      LIMIT 1;
    `
    const current = rows.rows?.[0]
    if (!current) return
    const previousStatus = current.status
    if (previousStatus === input.nextStatus) return
    if (!OPERATION_TRANSITIONS[previousStatus]?.has(input.nextStatus)) {
      throw new ControlPlaneOperationError({
        code: 'invalid_operation_status_transition',
        message: `Invalid operation transition ${previousStatus} -> ${input.nextStatus}`,
      })
    }
    const policyVersion = current.policy_version
    await runInTransaction(async (txDb) => {
      const updateResult = await txDb.sql`
        UPDATE public.control_plane_operations
        SET status = ${input.nextStatus},
            result_json = COALESCE(${JSON.stringify(canonicalize(input.result ?? {}))}::jsonb, result_json),
            error_code = COALESCE(${input.errorCode ?? null}, error_code),
            error_message = COALESCE(${input.errorMessage ?? null}, error_message),
            updated_at = NOW(),
            finished_at = CASE WHEN ${NON_TERMINAL_OPERATION_STATUSES.has(input.nextStatus)} THEN finished_at ELSE NOW() END
        WHERE operation_id = ${input.operationId}
          AND status = ${previousStatus};
      `
      if ((updateResult.rowCount ?? 0) === 0) {
        throw new ControlPlaneOperationError({
          code: 'transition_race',
          message: `Operation transition lost race ${previousStatus} -> ${input.nextStatus}`,
        })
      }
      await safeInsertEvent({
        db: txDb as Db,
        operationId: input.operationId,
        eventType: 'operation.status_transition',
        message: input.reason,
        data: {
          previousStatus,
          nextStatus: input.nextStatus,
          reason: input.reason,
          actor: input.actor ?? 'system',
          policyVersion,
          ...(input.data ?? {}),
        },
      })
    })
    emitControlPlaneMetric({
      metric: 'control_plane.operation.status',
      status: input.nextStatus,
      operationId: input.operationId,
    })
  } catch (error) {
    if (error instanceof ControlPlaneOperationError) throw error
    if (isMissingTableError(error)) return
    console.warn('[control-plane/operations] Failed operation transition', {
      operationId: input.operationId,
      nextStatus: input.nextStatus,
      reason: input.reason,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function transitionStageStatus(input: TransitionStageStatusInput): Promise<void> {
  const db = await getDbSafe()
  if (!db) return
  try {
    const rows = await db.sql<{ operation_id: string; status: StageStatus; attempt_count: number }>`
      SELECT operation_id, status, attempt_count
      FROM public.control_plane_stages
      WHERE stage_id = ${input.stageId}
      LIMIT 1;
    `
    const current = rows.rows?.[0]
    if (!current) return
    const previousStatus = current.status
    if (previousStatus === input.nextStatus) return
    if (!STAGE_TRANSITIONS[previousStatus]?.has(input.nextStatus)) {
      throw new ControlPlaneOperationError({
        code: 'invalid_stage_status_transition',
        message: `Invalid stage transition ${previousStatus} -> ${input.nextStatus}`,
      })
    }
    const operationId = current.operation_id
    await runInTransaction(async (txDb) => {
      const updateResult = await txDb.sql`
        UPDATE public.control_plane_stages
        SET status = ${input.nextStatus},
            result_json = COALESCE(${JSON.stringify(canonicalize(input.result ?? {}))}::jsonb, result_json),
            error_code = COALESCE(${input.errorCode ?? null}, error_code),
            error_message = COALESCE(${input.errorMessage ?? null}, error_message),
            started_at = CASE WHEN ${input.nextStatus} = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
            finished_at = CASE WHEN ${NON_TERMINAL_OPERATION_STATUSES.has(input.nextStatus)} THEN finished_at ELSE NOW() END,
            attempt_count = CASE WHEN ${input.nextStatus} IN ('running', 'retrying') THEN attempt_count + 1 ELSE attempt_count END
        WHERE stage_id = ${input.stageId}
          AND status = ${previousStatus};
      `
      if ((updateResult.rowCount ?? 0) === 0) {
        throw new ControlPlaneOperationError({
          code: 'transition_race',
          message: `Stage transition lost race ${previousStatus} -> ${input.nextStatus}`,
        })
      }
      await safeInsertEvent({
        db: txDb as Db,
        operationId,
        stageId: input.stageId,
        eventType: 'stage.status_transition',
        message: input.reason,
        data: {
          previousStatus,
          nextStatus: input.nextStatus,
          reason: input.reason,
          actor: input.actor ?? 'system',
          attemptCount: current.attempt_count,
          ...(input.data ?? {}),
        },
      })
    })
    emitControlPlaneMetric({
      metric: 'control_plane.stage.status',
      status: input.nextStatus,
      operationId: current.operation_id,
      stageId: input.stageId,
    })
  } catch (error) {
    if (error instanceof ControlPlaneOperationError) throw error
    if (isMissingTableError(error)) return
    console.warn('[control-plane/operations] Failed stage transition', {
      stageId: input.stageId,
      nextStatus: input.nextStatus,
      reason: input.reason,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function completeControlPlaneOperation(input: CompleteControlPlaneOperationInput): Promise<void> {
  await transitionOperationStatus({
    operationId: input.operationId,
    nextStatus: input.status,
    reason: input.status === 'succeeded' ? 'operation_completed' : 'operation_failed',
    actor: input.actor ?? 'system',
    result: input.result ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
  })
}

