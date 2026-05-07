import { getDb } from '../db/postgres.js'

export type KeeperJobStatus = 'pending' | 'claimed' | 'succeeded' | 'failed' | 'retry'

export type KeeperJob = {
  id: number
  kind: string
  status: KeeperJobStatus
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  source: string
  dedupeKey: string | null
  runAt: string
  claimedBy: string | null
  claimedAt: string | null
  claimExpiresAt: string | null
  attemptCount: number
  maxAttempts: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type EnqueueKeeperJobInput = {
  kind: string
  payload: Record<string, unknown>
  source?: string | null
  dedupeKey?: string | null
  priority?: number | null
  runAt?: string | null
  maxAttempts?: number | null
}

export type ClaimKeeperJobsInput = {
  workerId: string
  limit?: number | null
  leaseSeconds?: number | null
  kinds?: string[] | null
}

export type CompleteKeeperJobInput = {
  id: number
  workerId: string
  status: Extract<KeeperJobStatus, 'succeeded' | 'failed' | 'retry'>
  error?: string | null
  result?: Record<string, unknown> | null
  retryDelaySeconds?: number | null
}

export type ListKeeperJobsInput = {
  status?: KeeperJobStatus | null
  kind?: string | null
  limit?: number | null
}

const VALID_STATUSES = new Set<KeeperJobStatus>(['pending', 'claimed', 'succeeded', 'failed', 'retry'])
const KIND_PATTERN = /^[a-z][a-z0-9_.:-]{1,79}$/

function toIso(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeKind(value: unknown): string {
  const kind = typeof value === 'string' ? value.trim() : ''
  if (!KIND_PATTERN.test(kind)) throw new Error('invalid_keeper_job_kind')
  return kind
}

function normalizeSource(value: unknown): string {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source) return 'internal'
  return source.slice(0, 120)
}

function normalizeWorkerId(value: unknown): string {
  const workerId = typeof value === 'string' ? value.trim() : ''
  if (!workerId || workerId.length > 120) throw new Error('invalid_worker_id')
  return workerId
}

function normalizePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function normalizeRunAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_run_at')
  return date.toISOString()
}

function normalizeStatus(value: unknown): KeeperJobStatus | null {
  const status = typeof value === 'string' ? value.trim() : ''
  return VALID_STATUSES.has(status as KeeperJobStatus) ? (status as KeeperJobStatus) : null
}

function mapJobRow(row: any): KeeperJob {
  return {
    id: Number(row.id),
    kind: String(row.kind),
    status: String(row.status) as KeeperJobStatus,
    priority: Number(row.priority ?? 0),
    payload: asObject(row.payload),
    result: row.result ? asObject(row.result) : null,
    source: String(row.source ?? 'internal'),
    dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
    runAt: toIso(row.run_at),
    claimedBy: row.claimed_by ? String(row.claimed_by) : null,
    claimedAt: row.claimed_at ? toIso(row.claimed_at) : null,
    claimExpiresAt: row.claim_expires_at ? toIso(row.claim_expires_at) : null,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export async function enqueueKeeperJob(input: EnqueueKeeperJobInput): Promise<KeeperJob> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const kind = normalizeKind(input.kind)
  const payload = asObject(input.payload)
  const source = normalizeSource(input.source)
  const dedupeKey = typeof input.dedupeKey === 'string' && input.dedupeKey.trim() ? input.dedupeKey.trim().slice(0, 240) : null
  const priority = normalizePositiveInt(input.priority, 0, -1_000_000, 1_000_000)
  const maxAttempts = normalizePositiveInt(input.maxAttempts, 5, 1, 25)
  const runAt = normalizeRunAt(input.runAt)

  const result = await db.sql`
    INSERT INTO keeper_jobs (
      kind,
      payload,
      source,
      dedupe_key,
      priority,
      max_attempts,
      run_at,
      updated_at
    )
    VALUES (
      ${kind},
      ${payload},
      ${source},
      ${dedupeKey},
      ${priority},
      ${maxAttempts},
      COALESCE(${runAt}::timestamptz, NOW()),
      NOW()
    )
    ON CONFLICT (dedupe_key)
      WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'claimed', 'retry')
    DO UPDATE SET
      payload = EXCLUDED.payload,
      source = EXCLUDED.source,
      priority = GREATEST(keeper_jobs.priority, EXCLUDED.priority),
      run_at = LEAST(keeper_jobs.run_at, EXCLUDED.run_at),
      updated_at = NOW()
    RETURNING *;
  `

  const row = result.rows?.[0]
  if (!row) throw new Error('keeper_job_enqueue_failed')
  return mapJobRow(row)
}

export async function claimDueKeeperJobs(input: ClaimKeeperJobsInput): Promise<KeeperJob[]> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const workerId = normalizeWorkerId(input.workerId)
  const limit = normalizePositiveInt(input.limit, 1, 1, 25)
  const leaseSeconds = normalizePositiveInt(input.leaseSeconds, 300, 30, 3600)
  const kinds = Array.isArray(input.kinds) ? input.kinds.map(normalizeKind).slice(0, 25) : []

  const result = await db.sql`
    UPDATE keeper_jobs
    SET
      status = 'claimed',
      claimed_by = ${workerId},
      claimed_at = NOW(),
      claim_expires_at = NOW() + (${leaseSeconds} || ' seconds')::interval,
      attempt_count = attempt_count + 1,
      updated_at = NOW()
    WHERE id IN (
      SELECT id
      FROM keeper_jobs
      WHERE status IN ('pending', 'retry')
        AND run_at <= NOW()
        AND attempt_count < max_attempts
        AND (array_length(${kinds}::text[], 1) IS NULL OR kind = ANY(${kinds}::text[]))
      ORDER BY priority DESC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *;
  `
  return (result.rows ?? []).map(mapJobRow)
}

export async function completeKeeperJob(input: CompleteKeeperJobInput): Promise<KeeperJob | null> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const id = Number(input.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid_keeper_job_id')
  const workerId = normalizeWorkerId(input.workerId)
  const status = normalizeStatus(input.status)
  if (status !== 'succeeded' && status !== 'failed' && status !== 'retry') {
    throw new Error('invalid_keeper_job_completion_status')
  }
  const error = typeof input.error === 'string' && input.error.trim() ? input.error.trim().slice(0, 2000) : null
  const resultPayload = input.result && typeof input.result === 'object' && !Array.isArray(input.result) ? input.result : null
  const retryDelaySeconds = normalizePositiveInt(input.retryDelaySeconds, 60, 1, 86_400)

  const result = await db.sql`
    UPDATE keeper_jobs
    SET
      status = CASE
        WHEN ${status} = 'retry' AND attempt_count >= max_attempts THEN 'failed'
        ELSE ${status}
      END,
      result = ${resultPayload},
      last_error = ${error},
      run_at = CASE
        WHEN ${status} = 'retry' AND attempt_count < max_attempts
          THEN NOW() + (${retryDelaySeconds} || ' seconds')::interval
        ELSE run_at
      END,
      claimed_by = NULL,
      claimed_at = NULL,
      claim_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${id}
      AND status = 'claimed'
      AND claimed_by = ${workerId}
    RETURNING *;
  `

  const row = result.rows?.[0]
  return row ? mapJobRow(row) : null
}

export async function releaseExpiredKeeperJobClaims(): Promise<number> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const result = await db.sql`
    UPDATE keeper_jobs
    SET
      status = 'retry',
      claimed_by = NULL,
      claimed_at = NULL,
      claim_expires_at = NULL,
      last_error = COALESCE(last_error, 'claim_expired'),
      updated_at = NOW()
    WHERE status = 'claimed'
      AND claim_expires_at IS NOT NULL
      AND claim_expires_at <= NOW()
      AND attempt_count < max_attempts
    RETURNING id;
  `
  return result.rows?.length ?? 0
}

export async function listKeeperJobs(input: ListKeeperJobsInput = {}): Promise<KeeperJob[]> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const status = normalizeStatus(input.status)
  const kind = typeof input.kind === 'string' && input.kind.trim() ? normalizeKind(input.kind) : null
  const limit = normalizePositiveInt(input.limit, 25, 1, 100)

  const result = await db.sql`
    SELECT *
    FROM keeper_jobs
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${kind}::text IS NULL OR kind = ${kind})
    ORDER BY created_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapJobRow)
}
