import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDb,
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'

type AdminControlPlaneOperationDetail = {
  admin: string
  operation: {
    operationId: string
    operationKind: string
    status: string
    scopeType: string
    scopeId: string
    lockScope: string | null
    lockKey: string | null
    idempotencyKey: string | null
    idempotencyFingerprint: string | null
    policyVersion: string | null
    schemaVersion: string | null
    requestedBy: string | null
    errorCode: string | null
    errorMessage: string | null
    input: Record<string, unknown>
    result: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    finishedAt: string | null
  }
  stages: Array<{
    stageId: string
    stageKind: string
    status: string
    attemptCount: number
    errorCode: string | null
    errorMessage: string | null
    input: Record<string, unknown>
    result: Record<string, unknown> | null
    startedAt: string | null
    finishedAt: string | null
    createdAt: string
    updatedAt: string
  }>
  events: Array<{
    eventType: string
    stageId: string | null
    message: string
    data: Record<string, unknown>
    createdAt: string
  }>
  jobs: Array<{
    id: number
    stageId: string | null
    kind: string
    status: string
    attemptCount: number
    maxAttempts: number
    dedupeKey: string | null
    source: string
    lastError: string | null
    createdAt: string
    updatedAt: string
    runAt: string
    claimedBy: string | null
    claimExpiresAt: string | null
  }>
}

function parsePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function optionalIso(value: unknown): string | null {
  const iso = toIso(value)
  return iso || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const operationId = typeof req.query.operationId === 'string' ? req.query.operationId.trim() : ''
  if (!operationId) {
    return res.status(400).json({ success: false, error: 'Missing operationId' } satisfies ApiEnvelope<never>)
  }
  if (operationId.length > 200) {
    return res.status(400).json({ success: false, error: 'Invalid operationId' } satisfies ApiEnvelope<never>)
  }

  const eventsLimit = parsePositiveInt(req.query.eventsLimit, 250, 1, 2_000)
  const jobsLimit = parsePositiveInt(req.query.jobsLimit, 100, 1, 1_000)

  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }

    const opRes = await db.sql<{
      operation_id: string
      operation_kind: string
      status: string
      scope_type: string
      scope_id: string
      lock_scope: string | null
      lock_key: string | null
      idempotency_key: string | null
      idempotency_fingerprint: string | null
      policy_version: string | null
      schema_version: string | null
      requested_by: string | null
      error_code: string | null
      error_message: string | null
      input_json: unknown
      result_json: unknown
      created_at: string
      updated_at: string
      finished_at: string | null
    }>`
      SELECT
        operation_id,
        operation_kind,
        status,
        scope_type,
        scope_id,
        lock_scope,
        lock_key,
        idempotency_key,
        idempotency_fingerprint,
        policy_version,
        schema_version,
        requested_by,
        error_code,
        error_message,
        input_json,
        result_json,
        created_at,
        updated_at,
        finished_at
      FROM public.control_plane_operations
      WHERE operation_id = ${operationId}
      LIMIT 1;
    `
    const opRow = opRes.rows?.[0]
    if (!opRow) {
      return res.status(404).json({ success: false, error: 'Operation not found' } satisfies ApiEnvelope<never>)
    }

    const [stagesRes, eventsRes, jobsRes] = await Promise.all([
      db.sql<{
        stage_id: string
        stage_kind: string
        status: string
        attempt_count: number
        error_code: string | null
        error_message: string | null
        input_json: unknown
        result_json: unknown
        started_at: string | null
        finished_at: string | null
        created_at: string
        updated_at: string
      }>`
        SELECT
          stage_id,
          stage_kind,
          status,
          attempt_count,
          error_code,
          error_message,
          input_json,
          result_json,
          started_at,
          finished_at,
          created_at,
          updated_at
        FROM public.control_plane_stages
        WHERE operation_id = ${operationId}
        ORDER BY created_at ASC;
      `,
      db.sql<{
        event_type: string
        stage_id: string | null
        message: string
        data_json: unknown
        created_at: string
      }>`
        SELECT event_type, stage_id, message, data_json, created_at
        FROM public.control_plane_events
        WHERE operation_id = ${operationId}
        ORDER BY created_at ASC
        LIMIT ${eventsLimit};
      `,
      db.sql<{
        id: number
        stage_id: string | null
        kind: string
        status: string
        attempt_count: number
        max_attempts: number
        dedupe_key: string | null
        source: string
        last_error: string | null
        created_at: string
        updated_at: string
        run_at: string
        claimed_by: string | null
        claim_expires_at: string | null
      }>`
        SELECT
          id,
          stage_id,
          kind,
          status,
          attempt_count,
          max_attempts,
          dedupe_key,
          source,
          last_error,
          created_at,
          updated_at,
          run_at,
          claimed_by,
          claim_expires_at
        FROM public.keeper_jobs
        WHERE operation_id = ${operationId}
        ORDER BY created_at DESC
        LIMIT ${jobsLimit};
      `,
    ])

    const data: AdminControlPlaneOperationDetail = {
      admin,
      operation: {
        operationId: String(opRow.operation_id),
        operationKind: String(opRow.operation_kind),
        status: String(opRow.status),
        scopeType: String(opRow.scope_type),
        scopeId: String(opRow.scope_id),
        lockScope: opRow.lock_scope ? String(opRow.lock_scope) : null,
        lockKey: opRow.lock_key ? String(opRow.lock_key) : null,
        idempotencyKey: opRow.idempotency_key ? String(opRow.idempotency_key) : null,
        idempotencyFingerprint: opRow.idempotency_fingerprint ? String(opRow.idempotency_fingerprint) : null,
        policyVersion: opRow.policy_version ? String(opRow.policy_version) : null,
        schemaVersion: opRow.schema_version ? String(opRow.schema_version) : null,
        requestedBy: opRow.requested_by ? String(opRow.requested_by) : null,
        errorCode: opRow.error_code ? String(opRow.error_code) : null,
        errorMessage: opRow.error_message ? String(opRow.error_message) : null,
        input: asObject(opRow.input_json),
        result: opRow.result_json ? asObject(opRow.result_json) : null,
        createdAt: toIso(opRow.created_at),
        updatedAt: toIso(opRow.updated_at),
        finishedAt: optionalIso(opRow.finished_at),
      },
      stages: (stagesRes.rows ?? []).map((row) => ({
        stageId: String(row.stage_id),
        stageKind: String(row.stage_kind),
        status: String(row.status),
        attemptCount: Number(row.attempt_count ?? 0),
        errorCode: row.error_code ? String(row.error_code) : null,
        errorMessage: row.error_message ? String(row.error_message) : null,
        input: asObject(row.input_json),
        result: row.result_json ? asObject(row.result_json) : null,
        startedAt: optionalIso(row.started_at),
        finishedAt: optionalIso(row.finished_at),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      })),
      events: (eventsRes.rows ?? []).map((row) => ({
        eventType: String(row.event_type),
        stageId: row.stage_id ? String(row.stage_id) : null,
        message: String(row.message ?? ''),
        data: asObject(row.data_json),
        createdAt: toIso(row.created_at),
      })),
      jobs: (jobsRes.rows ?? []).map((row) => ({
        id: Number(row.id),
        stageId: row.stage_id ? String(row.stage_id) : null,
        kind: String(row.kind),
        status: String(row.status),
        attemptCount: Number(row.attempt_count ?? 0),
        maxAttempts: Number(row.max_attempts ?? 0),
        dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
        source: String(row.source ?? ''),
        lastError: row.last_error ? String(row.last_error) : null,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        runAt: toIso(row.run_at),
        claimedBy: row.claimed_by ? String(row.claimed_by) : null,
        claimExpiresAt: optionalIso(row.claim_expires_at),
      })),
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AdminControlPlaneOperationDetail>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'control_plane_operation_detail_failed'
    if (/control_plane_operations|control_plane_stages|control_plane_events|keeper_jobs/i.test(message)) {
      return res.status(503).json({
        success: false,
        error:
          'control_plane_schema_missing: apply control-plane migrations to DATABASE_URL target before using this endpoint',
      } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

