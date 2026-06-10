import { createHash, createHmac, randomBytes } from 'node:crypto'

import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureMigrationApplied, ensureFinalAdditiveColumns } from '../db/schemaBootstrap.js'

declare const process: { env: Record<string, string | undefined> }

export type DeploySessionStep =
  | 'created'
  | 'phase1_sent'
  | 'phase1_confirmed'
  | 'phase1_finalize_sent'
  | 'phase1_finalize_confirmed'
  | 'phase2_core_sent'
  | 'phase2_core_confirmed'
  | 'phase2_finalize_sent'
  | 'phase2_finalize_confirmed'
  // Legacy aliases kept for in-flight/read compatibility.
  | 'phase2_sent'
  | 'phase2_confirmed'
  | 'ovault_mesh_sent'
  | 'ovault_mesh_confirmed'
  | 'phase3_sent'
  | 'phase3_confirmed'
  | 'phase4_sent'
  | 'phase4_confirmed'
  | 'cleanup_sent'
  | 'cancelled'
  | 'completed'
  | 'failed'

export type DeploySessionState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type DeploySessionRecord = {
  id: string
  tokenHash: string
  sessionAddress: `0x${string}`
  smartWallet: `0x${string}`
  sessionSigner: `0x${string}`
  deployToken: string
  payload: any
  step: DeploySessionStep
  expiresAt: string
  createdAt: string
  updatedAt: string
  lastError: string | null
  lastUserOpHash: string | null
  lastTxHash: string | null
  state: DeploySessionState
  currentStage: DeploySessionStep
  attemptCount: number
  nextRunAfter: string | null
  lockOwner: string | null
  lockExpiresAt: string | null
  lastFailureCode: string | null
  lastFailureStage: string | null
  artifacts: Record<string, unknown>
}

let deploySessionsSchemaEnsured = false

const TERMINAL_STEPS = new Set<DeploySessionStep>(['completed', 'cancelled', 'failed'])

function deriveStateFromStep(step: DeploySessionStep): DeploySessionState {
  if (step === 'completed') return 'completed'
  if (step === 'cancelled') return 'cancelled'
  if (step === 'failed') return 'failed'
  if (step.endsWith('_sent') || step === 'created') return 'running'
  return 'pending'
}

export async function ensureDeploySessionsSchema(): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  if (deploySessionsSchemaEnsured) return
  try {
    // Delegate to prior authoritative deploy sessions migrations (e.g. 20260423193000_deploy_sessions_v2_schema.sql
    // and related evolution files in supabase/migrations/). The old raw DDL block has been retired.
    await ensureMigrationApplied(db as any, '20260423193000_deploy_sessions_v2_schema.sql').catch(() => {})
    // Any remaining additive ALTERs from the old ensure are now covered by migration history or are safe no-ops.
    try {
      await ensureFinalAdditiveColumns(db as any).catch(() => {})
    } catch {
      // ignore (already exists or insufficient permissions)
    }
    // Remaining ALTERs/indexes from the old raw ensure are now delegated to migration history.
    try {
      await db.sql`CREATE INDEX IF NOT EXISTS deploys_current_stage_idx ON deploys (current_stage);`
    } catch {
      // ignore
    }
    // Any remaining data-fix UPDATE or extra indexes from the old raw ensure have been retired.
    // The function now relies on prior migrations for schema shape.
    // Data backfill UPDATEs retired — any needed data fixes belong in one-time migrations or admin scripts.
    deploySessionsSchemaEnsured = true
  } catch (err) {
    deploySessionsSchemaEnsured = false
    throw err
  }
}

export function randomId(prefix = 'ds_'): string {
  return `${prefix}${randomBytes(16).toString('hex')}`
}

export function randomDeployToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDeployToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function signDeployToken(token: string): string {
  const raw = (process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET ?? '').trim()
  if (!raw) throw new Error('DEPLOY_SESSION_TOKEN_HMAC_SECRET missing')
  return createHmac('sha256', raw).update(token, 'utf8').digest('hex')
}

export async function insertDeploySession(params: {
  id: string
  tokenHash: string
  sessionAddress: string
  smartWallet: string
  sessionSigner: string
  deployToken: string
  payload: any
  expiresAt: Date
}): Promise<DeploySessionRecord> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()

  const payloadJson = params.payload ?? {}

  // FIX: FINDING-14 — do not store plaintext deploy_token in DB; use token_hash for
  // lookup and require the plaintext only from the caller via HTTP headers.
  // A redacted placeholder satisfies the NOT NULL column constraint for backward compat.
  await db.sql`
    INSERT INTO deploys (
      id,
      token_hash,
      session_address,
      smart_wallet,
      session_owner,
      deploy_token,
      session_owner_key_enc,
      payload,
      step,
      current_stage,
      state,
      artifacts,
      expires_at
    ) VALUES (
      ${params.id},
      ${params.tokenHash},
      ${String(params.sessionAddress).toLowerCase()},
      ${String(params.smartWallet).toLowerCase()},
      ${String(params.sessionSigner).toLowerCase()},
      ${'[redacted]'},
      ${null},
      ${payloadJson},
      ${'created'},
      ${'created'},
      ${'running'},
      ${{}},
      ${params.expiresAt.toISOString()}
    );
  `
  // Best-effort dual-write for non-breaking migration to canonical `session_signer*` columns.
  try {
    await db.sql`
      UPDATE deploys
      SET
        session_signer = ${String(params.sessionSigner).toLowerCase()},
        session_signer_key_enc = ${null}
      WHERE id = ${params.id};
    `
  } catch {
    // ignore when migration columns are unavailable
  }

  const rec = await getDeploySessionById(params.id)
  if (!rec) throw new Error('deploy_session_create_failed')
  return rec
}

export async function getDeploySessionById(id: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploys WHERE id = ${id} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getDeploySessionByTokenHash(tokenHash: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploys WHERE token_hash = ${tokenHash} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getActiveDeploySessionForSender(params: {
  sessionAddress: string
  smartWallet: string
  /**
   * Allow selecting a session even if it is expired.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeExpired?: boolean
  /**
   * Allow selecting a session even if it is in the `failed` step.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeFailed?: boolean
}): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const includeExpired = params.includeExpired === true
  const includeFailed = params.includeFailed === true
  // NOTE: Avoid nested `db.sql` fragments here.
  // - `@vercel/postgres` supports flexible interpolation, but our `pg` fallback implements a minimal
  //   template-to-parameter conversion and treats interpolated fragments as values (→ `step $3` syntax errors).
  const sessionAddress = String(params.sessionAddress).toLowerCase()
  const smartWallet = String(params.smartWallet).toLowerCase()
  const res = includeExpired
    ? includeFailed
      ? await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
          ORDER BY created_at DESC
          LIMIT 1;
        `
    : includeFailed
      ? await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function updateDeploySession(params: {
  id: string
  step?: DeploySessionStep
  state?: DeploySessionState
  currentStage?: DeploySessionStep
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  lastFailureCode?: string | null
  lastFailureStage?: string | null
  nextRunAfter?: Date | null
  lockOwner?: string | null
  lockExpiresAt?: Date | null
  attemptCount?: number | null
  payloadPatch?: any
  artifactsPatch?: Record<string, unknown>
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  const hasStep = Object.prototype.hasOwnProperty.call(params, 'step')
  const hasState = Object.prototype.hasOwnProperty.call(params, 'state')
  const hasCurrentStage = Object.prototype.hasOwnProperty.call(params, 'currentStage')
  const hasLastError = Object.prototype.hasOwnProperty.call(params, 'lastError')
  const hasLastUserOpHash = Object.prototype.hasOwnProperty.call(params, 'lastUserOpHash')
  const hasLastTxHash = Object.prototype.hasOwnProperty.call(params, 'lastTxHash')
  const hasLastFailureCode = Object.prototype.hasOwnProperty.call(params, 'lastFailureCode')
  const hasLastFailureStage = Object.prototype.hasOwnProperty.call(params, 'lastFailureStage')
  const hasNextRunAfter = Object.prototype.hasOwnProperty.call(params, 'nextRunAfter')
  const hasLockOwner = Object.prototype.hasOwnProperty.call(params, 'lockOwner')
  const hasLockExpiresAt = Object.prototype.hasOwnProperty.call(params, 'lockExpiresAt')
  const hasAttemptCount = Object.prototype.hasOwnProperty.call(params, 'attemptCount')
  const derivedState = hasStep ? deriveStateFromStep(params.step ?? 'created') : null

  const patch = params.payloadPatch
  const artifactsPatch = params.artifactsPatch
  const hasPayloadPatch = Boolean(patch && typeof patch === 'object')
  const hasArtifactsPatch = Boolean(artifactsPatch && typeof artifactsPatch === 'object')

  if (hasPayloadPatch || hasArtifactsPatch) {
    // Merge JSONB (right-biased).
    await db.sql`
      UPDATE deploys
      SET
        payload = CASE
          WHEN ${hasPayloadPatch} THEN COALESCE(payload, '{}'::jsonb) || ${patch ?? {}}
          ELSE payload
        END,
        artifacts = CASE
          WHEN ${hasArtifactsPatch} THEN COALESCE(artifacts, '{}'::jsonb) || ${artifactsPatch ?? {}}
          ELSE artifacts
        END,
        step = CASE WHEN ${hasStep} THEN ${params.step ?? null} ELSE step END,
        current_stage = CASE
          WHEN ${hasCurrentStage} THEN ${params.currentStage ?? null}
          WHEN ${hasStep} THEN ${params.step ?? null}
          ELSE current_stage
        END,
        state = CASE
          WHEN ${hasState} THEN ${params.state ?? null}
          WHEN ${hasStep} THEN ${derivedState}
          ELSE state
        END,
        last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
        last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
        last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
        last_failure_code = CASE WHEN ${hasLastFailureCode} THEN ${params.lastFailureCode ?? null} ELSE last_failure_code END,
        last_failure_stage = CASE WHEN ${hasLastFailureStage} THEN ${params.lastFailureStage ?? null} ELSE last_failure_stage END,
        next_run_after = CASE WHEN ${hasNextRunAfter} THEN ${params.nextRunAfter ? params.nextRunAfter.toISOString() : null} ELSE next_run_after END,
        lock_owner = CASE WHEN ${hasLockOwner} THEN ${params.lockOwner ?? null} ELSE lock_owner END,
        lock_expires_at = CASE WHEN ${hasLockExpiresAt} THEN ${params.lockExpiresAt ? params.lockExpiresAt.toISOString() : null} ELSE lock_expires_at END,
        attempt_count = CASE WHEN ${hasAttemptCount} THEN COALESCE(${params.attemptCount ?? null}, attempt_count) ELSE attempt_count END,
        updated_at = NOW()
      WHERE id = ${params.id};
    `
    return
  }

  await db.sql`
    UPDATE deploys
    SET
      step = CASE WHEN ${hasStep} THEN ${params.step ?? null} ELSE step END,
      current_stage = CASE
        WHEN ${hasCurrentStage} THEN ${params.currentStage ?? null}
        WHEN ${hasStep} THEN ${params.step ?? null}
        ELSE current_stage
      END,
      state = CASE
        WHEN ${hasState} THEN ${params.state ?? null}
        WHEN ${hasStep} THEN ${derivedState}
        ELSE state
      END,
      last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
      last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
      last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
      last_failure_code = CASE WHEN ${hasLastFailureCode} THEN ${params.lastFailureCode ?? null} ELSE last_failure_code END,
      last_failure_stage = CASE WHEN ${hasLastFailureStage} THEN ${params.lastFailureStage ?? null} ELSE last_failure_stage END,
      next_run_after = CASE WHEN ${hasNextRunAfter} THEN ${params.nextRunAfter ? params.nextRunAfter.toISOString() : null} ELSE next_run_after END,
      lock_owner = CASE WHEN ${hasLockOwner} THEN ${params.lockOwner ?? null} ELSE lock_owner END,
      lock_expires_at = CASE WHEN ${hasLockExpiresAt} THEN ${params.lockExpiresAt ? params.lockExpiresAt.toISOString() : null} ELSE lock_expires_at END,
      attempt_count = CASE WHEN ${hasAttemptCount} THEN COALESCE(${params.attemptCount ?? null}, attempt_count) ELSE attempt_count END,
      updated_at = NOW()
    WHERE id = ${params.id};
  `
}

export async function transitionDeploySession(params: {
  id: string
  fromStep: DeploySessionStep
  toStep: DeploySessionStep
  state?: DeploySessionState
  currentStage?: DeploySessionStep
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  lastFailureCode?: string | null
  lastFailureStage?: string | null
  nextRunAfter?: Date | null
  lockOwner?: string | null
  lockExpiresAt?: Date | null
  attemptCount?: number | null
  payloadPatch?: any
  artifactsPatch?: Record<string, unknown>
}): Promise<boolean> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  const hasLastError = Object.prototype.hasOwnProperty.call(params, 'lastError')
  const hasLastUserOpHash = Object.prototype.hasOwnProperty.call(params, 'lastUserOpHash')
  const hasLastTxHash = Object.prototype.hasOwnProperty.call(params, 'lastTxHash')
  const hasState = Object.prototype.hasOwnProperty.call(params, 'state')
  const hasCurrentStage = Object.prototype.hasOwnProperty.call(params, 'currentStage')
  const hasLastFailureCode = Object.prototype.hasOwnProperty.call(params, 'lastFailureCode')
  const hasLastFailureStage = Object.prototype.hasOwnProperty.call(params, 'lastFailureStage')
  const hasNextRunAfter = Object.prototype.hasOwnProperty.call(params, 'nextRunAfter')
  const hasLockOwner = Object.prototype.hasOwnProperty.call(params, 'lockOwner')
  const hasLockExpiresAt = Object.prototype.hasOwnProperty.call(params, 'lockExpiresAt')
  const hasAttemptCount = Object.prototype.hasOwnProperty.call(params, 'attemptCount')

  const patch = params.payloadPatch
  const artifactsPatch = params.artifactsPatch
  const hasArtifactsPatch = Boolean(artifactsPatch && typeof artifactsPatch === 'object')
  const derivedState = deriveStateFromStep(params.toStep)
  const hasPayloadPatch = Boolean(patch && typeof patch === 'object')
  const result =
    hasPayloadPatch || hasArtifactsPatch
      ? await db.sql`
          UPDATE deploys
          SET
            payload = CASE
              WHEN ${hasPayloadPatch} THEN COALESCE(payload, '{}'::jsonb) || ${patch ?? {}}
              ELSE payload
            END,
            step = ${params.toStep},
            current_stage = CASE
              WHEN ${hasCurrentStage} THEN ${params.currentStage ?? null}
              ELSE ${params.toStep}
            END,
            state = CASE
              WHEN ${hasState} THEN ${params.state ?? null}
              ELSE ${derivedState}
            END,
            artifacts = CASE
              WHEN ${hasArtifactsPatch} THEN COALESCE(artifacts, '{}'::jsonb) || ${artifactsPatch ?? {}}
              ELSE artifacts
            END,
            last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
            last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
            last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
            last_failure_code = CASE WHEN ${hasLastFailureCode} THEN ${params.lastFailureCode ?? null} ELSE last_failure_code END,
            last_failure_stage = CASE WHEN ${hasLastFailureStage} THEN ${params.lastFailureStage ?? null} ELSE last_failure_stage END,
            next_run_after = CASE WHEN ${hasNextRunAfter} THEN ${params.nextRunAfter ? params.nextRunAfter.toISOString() : null} ELSE next_run_after END,
            lock_owner = CASE WHEN ${hasLockOwner} THEN ${params.lockOwner ?? null} ELSE lock_owner END,
            lock_expires_at = CASE WHEN ${hasLockExpiresAt} THEN ${params.lockExpiresAt ? params.lockExpiresAt.toISOString() : null} ELSE lock_expires_at END,
            attempt_count = CASE WHEN ${hasAttemptCount} THEN COALESCE(${params.attemptCount ?? null}, attempt_count) ELSE attempt_count END,
            updated_at = NOW()
          WHERE id = ${params.id}
            AND step = ${params.fromStep}
          RETURNING id;
        `
      : await db.sql`
          UPDATE deploys
          SET
            step = ${params.toStep},
            current_stage = CASE
              WHEN ${hasCurrentStage} THEN ${params.currentStage ?? null}
              ELSE ${params.toStep}
            END,
            state = CASE
              WHEN ${hasState} THEN ${params.state ?? null}
              ELSE ${derivedState}
            END,
            last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
            last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
            last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
            last_failure_code = CASE WHEN ${hasLastFailureCode} THEN ${params.lastFailureCode ?? null} ELSE last_failure_code END,
            last_failure_stage = CASE WHEN ${hasLastFailureStage} THEN ${params.lastFailureStage ?? null} ELSE last_failure_stage END,
            next_run_after = CASE WHEN ${hasNextRunAfter} THEN ${params.nextRunAfter ? params.nextRunAfter.toISOString() : null} ELSE next_run_after END,
            lock_owner = CASE WHEN ${hasLockOwner} THEN ${params.lockOwner ?? null} ELSE lock_owner END,
            lock_expires_at = CASE WHEN ${hasLockExpiresAt} THEN ${params.lockExpiresAt ? params.lockExpiresAt.toISOString() : null} ELSE lock_expires_at END,
            attempt_count = CASE WHEN ${hasAttemptCount} THEN COALESCE(${params.attemptCount ?? null}, attempt_count) ELSE attempt_count END,
            updated_at = NOW()
          WHERE id = ${params.id}
            AND step = ${params.fromStep}
          RETURNING id;
        `

  return Array.isArray(result.rows) && result.rows.length > 0
}

export function isDeploySessionTerminal(step: DeploySessionStep): boolean {
  return TERMINAL_STEPS.has(step)
}

export async function listRunnableDeploySessions(params?: {
  limit?: number
  now?: Date
}): Promise<DeploySessionRecord[]> {
  const db = await getDb()
  if (!db) return []
  await ensureDeploySessionsSchema()
  const limit = Math.max(1, Math.min(200, Math.floor(params?.limit ?? 20)))
  const nowIso = (params?.now ?? new Date()).toISOString()
  const res = await db.sql`
    SELECT *
    FROM deploys
    WHERE state IN ('pending', 'running')
      AND step NOT IN ('completed', 'cancelled', 'failed')
      AND expires_at > ${nowIso}
      AND (next_run_after IS NULL OR next_run_after <= ${nowIso})
      AND (lock_expires_at IS NULL OR lock_expires_at <= ${nowIso})
    ORDER BY COALESCE(next_run_after, created_at) ASC
    LIMIT ${limit};
  `
  const rows = Array.isArray(res.rows) ? res.rows : []
  return rows.map((row: any) => mapRow(row))
}

export async function claimDeploySessionLease(params: {
  id: string
  expectedStep?: DeploySessionStep
  workerId: string
  leaseMs: number
  now?: Date
}): Promise<boolean> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  const now = params.now ?? new Date()
  const leaseMs = Math.max(5_000, Math.min(10 * 60_000, Math.floor(params.leaseMs)))
  const lockExpiresAt = new Date(now.getTime() + leaseMs).toISOString()
  const nowIso = now.toISOString()
  const expectedStep = params.expectedStep ?? null
  const result = await db.sql`
    UPDATE deploys
    SET
      lock_owner = ${params.workerId},
      lock_expires_at = ${lockExpiresAt},
      state = CASE WHEN state = 'pending' THEN 'running' ELSE state END,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND (step NOT IN ('completed', 'cancelled', 'failed'))
      AND (expires_at > ${nowIso})
      AND (lock_expires_at IS NULL OR lock_expires_at <= ${nowIso})
      AND (${expectedStep}::text IS NULL OR step = ${expectedStep})
    RETURNING id;
  `
  return Array.isArray(result.rows) && result.rows.length > 0
}

export async function releaseDeploySessionLease(params: {
  id: string
  workerId: string
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  await db.sql`
    UPDATE deploys
    SET
      lock_owner = NULL,
      lock_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${params.id}
      AND lock_owner = ${params.workerId};
  `
}

function mapRow(r: any): DeploySessionRecord {
  const sessionSigner =
    (typeof r.session_signer === 'string' && r.session_signer.trim() ? r.session_signer : r.session_owner) ??
    r.session_owner
  const step = String(r.step) as DeploySessionStep
  const currentStageRaw = typeof r.current_stage === 'string' && r.current_stage.trim() ? r.current_stage : step
  const currentStage = String(currentStageRaw) as DeploySessionStep
  const stateRaw = typeof r.state === 'string' && r.state.trim() ? r.state : deriveStateFromStep(step)
  const state = String(stateRaw) as DeploySessionState
  const parseIso = (value: unknown): string | null => {
    if (value == null) return null
    const dt = new Date(String(value))
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  const parseIntSafe = (value: unknown): number => {
    const n = Number(value ?? 0)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.floor(n))
  }
  return {
    id: String(r.id),
    tokenHash: String(r.token_hash),
    sessionAddress: String(r.session_address).toLowerCase() as `0x${string}`,
    smartWallet: String(r.smart_wallet).toLowerCase() as `0x${string}`,
    sessionSigner: String(sessionSigner).toLowerCase() as `0x${string}`,
    deployToken: String(r.deploy_token),
    payload: r.payload,
    step,
    expiresAt: new Date(r.expires_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    lastError: r.last_error ? String(r.last_error) : null,
    lastUserOpHash: r.last_userop_hash ? String(r.last_userop_hash) : null,
    lastTxHash: r.last_tx_hash ? String(r.last_tx_hash) : null,
    state,
    currentStage,
    attemptCount: parseIntSafe(r.attempt_count),
    nextRunAfter: parseIso(r.next_run_after),
    lockOwner: r.lock_owner ? String(r.lock_owner) : null,
    lockExpiresAt: parseIso(r.lock_expires_at),
    lastFailureCode: r.last_failure_code ? String(r.last_failure_code) : null,
    lastFailureStage: r.last_failure_stage ? String(r.last_failure_stage) : null,
    artifacts: r.artifacts && typeof r.artifacts === 'object' ? (r.artifacts as Record<string, unknown>) : {},
  }
}
