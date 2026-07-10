/**
 * POST /api/keeper/solana/reconcile
 *
 * Idempotent bridge endpoint for Solana orchestration.
 * Stores workflow checkpoints in Postgres to ensure retry safety.
 */

import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  getDbForCron,
  isDbConfigured,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { ensureKeeprSchema } from '../../../server/_lib/keepr/keeprSchema.js'
import {
  beginOperationExecution,
  completeControlPlaneOperation,
  createControlPlaneStage,
  startControlPlaneOperation,
  transitionOperationStatus,
  transitionStageStatus,
} from '../../../server/_lib/controlPlane/operations.js'
import { loadControlPlanePolicy } from '../../../server/_lib/controlPlane/policy.js'

type ReconcileBody = {
  workflow?: string
  action?: string
  checkpointKey?: string
  payload?: Record<string, unknown>
}

type ReconcileResult = {
  workflow: string
  action: string
  checkpointKey: string
  status: 'already_processed' | 'completed' | 'failed' | 'skipped_unconfigured'
  executed: boolean
  retryable?: boolean
  upstreamStatusCode?: number
  upstreamResponse?: unknown
}

const RECONCILE_CLAIM_STALE_AFTER_SECONDS = 120

function buildSkippedResult(
  workflow: string,
  action: string,
  checkpointKey: string,
  reason: string,
): ReconcileResult {
  return {
    workflow,
    action,
    checkpointKey,
    status: 'skipped_unconfigured',
    executed: false,
    upstreamResponse: { reason },
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeSolanaAction(raw: string): string {
  return raw.trim().toLowerCase()
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readUpstreamRetryable(response: unknown, statusCode: number): boolean {
  const envelope = readObject(response)
  if (typeof envelope?.retryable === 'boolean') return envelope.retryable
  const data = readObject(envelope?.data)
  if (typeof data?.retryable === 'boolean') return data.retryable
  return statusCode === 429 || statusCode >= 500
}

function resolveStageKind(action: string): string {
  if (action.includes('sync_mapping')) return 'solana.bridge_token_registration'
  if (action.includes('bridge') || action.includes('register')) return 'solana.bridge_token_registration'
  if (action.includes('meteora')) return 'solana.meteora_instruction_build'
  if (action.includes('alpha')) return 'solana.alpha_vault_create'
  if (action.includes('submit')) return 'chain.transaction_submit'
  if (action.includes('confirm')) return 'chain.confirmation_wait'
  if (action.includes('reconcile') || action.includes('checkpoint')) return 'reconcile.checkpoint'
  return 'solana.route_preflight'
}

function readKnownMappingPayload(payload: Record<string, unknown>): {
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  sourceSessionId: string | null
} | null {
  const creatorToken = typeof payload.creatorToken === 'string' ? payload.creatorToken.trim() : ''
  const shareOft = typeof payload.shareOft === 'string' ? payload.shareOft.trim() : ''
  const shareMeshMint = typeof payload.shareMeshMint === 'string' ? payload.shareMeshMint.trim() : ''
  if (!creatorToken || !shareOft || !shareMeshMint) return null
  const sourceSessionId = typeof payload.sourceSessionId === 'string' ? payload.sourceSessionId.trim() : ''
  return { creatorToken, shareOft, shareMeshMint, sourceSessionId: sourceSessionId || null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-solana-reconcile', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as ReconcileBody | null
  const workflow = isNonEmptyString(body?.workflow) ? body.workflow.trim() : ''
  const action = isNonEmptyString(body?.action) ? normalizeSolanaAction(body.action) : ''
  const checkpointKey = isNonEmptyString(body?.checkpointKey) ? body.checkpointKey.trim() : ''
  const payload =
    body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload
      : {}

  if (!workflow || !action || !checkpointKey) {
    return res.status(400).json({
      success: false,
      error: 'workflow, action, and checkpointKey are required',
    } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'database_not_configured',
      data: { ...buildSkippedResult(workflow, action, checkpointKey, 'database_not_configured'), retryable: true },
    } satisfies ApiEnvelope<ReconcileResult>)
  }

  try {
    await ensureKeeprSchema()
    const db = await getDbForCron()
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'database_unavailable',
        data: { ...buildSkippedResult(workflow, action, checkpointKey, 'database_unavailable'), retryable: true },
      } satisfies ApiEnvelope<ReconcileResult>)
    }

    const policy = loadControlPlanePolicy()
    const operation = await startControlPlaneOperation({
      operationKind: 'solana.reconcile',
      scopeType: 'solana_route',
      scopeId: `${workflow}:${checkpointKey}`,
      lockScope: 'solana.reconcile',
      lockKey: `${workflow}:${checkpointKey}`,
      requestedBy: 'keeper/solana-reconcile',
      idempotencyKey: `${workflow}:${checkpointKey}`,
      policyVersion: policy.policyVersion,
      schemaVersion: 'v1',
      input: {
        workflow,
        action,
        checkpointKey,
        payload,
      },
    })
    const controlPlaneActive = operation.persisted
    let stageId: string | null = null
    let resumedFromTerminal = false
    if (controlPlaneActive) {
      const execution = await beginOperationExecution({
        operationId: operation.operationId,
        reason: 'solana_reconcile_started',
        actor: 'keeper',
      })
      resumedFromTerminal = execution.resumedFromTerminal
      const stage = await createControlPlaneStage({
        operationId: operation.operationId,
        stageKind: resolveStageKind(action),
        status: 'requested',
        input: { workflow, checkpointKey, action },
      })
      stageId = stage.persisted ? stage.stageId : null
      if (stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: 'running',
          reason: 'solana_reconcile_started',
          actor: 'keeper',
        })
      }
    }

    const attemptToken = randomUUID()
    const claimedAt = new Date().toISOString()
    const claimPayload = {
      schemaVersion: 'solana-reconcile-claim-v1',
      request: payload,
      claim: { attemptToken, claimedAt },
    }
    const claimResponse = { claim: { attemptToken } }
    const claim = await db.sql`
      WITH claimed AS (
        INSERT INTO keepr_workflow_checkpoints (
          workflow, checkpoint_key, action, status, payload_json, response_json, updated_at
        ) VALUES (
          ${workflow},
          ${checkpointKey},
          ${action},
          'processing',
          ${JSON.stringify(claimPayload)}::jsonb,
          ${JSON.stringify(claimResponse)}::jsonb,
          NOW()
        )
        ON CONFLICT (workflow, checkpoint_key)
        DO UPDATE SET
          status = 'processing',
          payload_json = jsonb_build_object(
            'schemaVersion', 'solana-reconcile-claim-v1',
            'request', CASE
              WHEN keepr_workflow_checkpoints.payload_json->>'schemaVersion' = 'solana-reconcile-claim-v1'
                THEN COALESCE(keepr_workflow_checkpoints.payload_json->'request', '{}'::jsonb)
              ELSE COALESCE(keepr_workflow_checkpoints.payload_json, '{}'::jsonb)
            END,
            'claim', EXCLUDED.payload_json->'claim'
          ),
          response_json = EXCLUDED.response_json,
          updated_at = NOW()
        WHERE keepr_workflow_checkpoints.status IN ('failed', 'skipped_unconfigured')
          OR (
            keepr_workflow_checkpoints.status = 'processing'
            AND keepr_workflow_checkpoints.updated_at
              < NOW() - (${RECONCILE_CLAIM_STALE_AFTER_SECONDS} * INTERVAL '1 second')
          )
        RETURNING status, response_json
      ),
      current_checkpoint AS (
        SELECT status, response_json
        FROM keepr_workflow_checkpoints
        WHERE workflow = ${workflow} AND checkpoint_key = ${checkpointKey}
        LIMIT 1
      )
      SELECT 'claimed' AS claim_outcome, status, response_json
      FROM claimed
      UNION ALL
      SELECT
        CASE WHEN status = 'completed' THEN 'completed' ELSE 'conflict' END AS claim_outcome,
        status,
        response_json
      FROM current_checkpoint
      WHERE NOT EXISTS (SELECT 1 FROM claimed)
      LIMIT 1;
    `
    const claimRow = claim.rows[0] as {
      claim_outcome?: 'claimed' | 'completed' | 'conflict'
      status?: string
      response_json?: unknown
    } | undefined
    if (claimRow?.claim_outcome === 'completed') {
      if (controlPlaneActive && stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: 'succeeded',
          reason: 'checkpoint_already_processed',
          actor: 'keeper',
        })
      }
      if (controlPlaneActive) {
        await completeControlPlaneOperation({
          operationId: operation.operationId,
          status: 'succeeded',
          result: { alreadyProcessed: true, workflow, checkpointKey },
          actor: 'keeper',
        })
      }
      const existing: ReconcileResult = {
        workflow,
        action,
        checkpointKey,
        status: 'already_processed',
        executed: false,
        upstreamResponse: claimRow.response_json,
      }
      return res.status(200).json({
        success: true,
        data: existing,
      } satisfies ApiEnvelope<ReconcileResult>)
    }
    if (claimRow?.claim_outcome !== 'claimed') {
      if (controlPlaneActive && stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: 'manual_review',
          reason: 'checkpoint_claim_active',
          actor: 'keeper',
          errorMessage: 'Another reconcile attempt currently holds the checkpoint claim',
        })
      }
      return res.status(409).json({
        success: false,
        error: 'solana_reconcile_claim_conflict',
        data: {
          workflow,
          action,
          checkpointKey,
          status: 'failed',
          executed: false,
          retryable: true,
          upstreamResponse: { reason: 'checkpoint_claim_active' },
        },
      } satisfies ApiEnvelope<ReconcileResult>)
    }

    const solanaOrchestratorUrl = (process.env.SOLANA_ORCHESTRATOR_URL ?? '').trim().replace(/\/$/, '')
    let status: ReconcileResult['status'] = 'skipped_unconfigured'
    let executed = false
    let retryable: boolean | undefined = true
    let upstreamStatusCode: number | undefined
    let upstreamResponse: unknown = null

    if (solanaOrchestratorUrl) {
      const normalizedAction = action.replace(/-/g, '_')
      const mappingPayload = normalizedAction === 'sync_mapping' ? readKnownMappingPayload(payload) : null
      const upstreamPayload =
        normalizedAction === 'sync_mapping' && mappingPayload
          ? mappingPayload
          : payload
      const upstream = await fetch(`${solanaOrchestratorUrl}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SOLANA_ORCHESTRATOR_API_KEY
            ? { Authorization: `Bearer ${process.env.SOLANA_ORCHESTRATOR_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          workflow,
          action: normalizedAction,
          checkpointKey,
          payload: upstreamPayload,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      upstreamStatusCode = upstream.status
      upstreamResponse = await upstream.json().catch(async () => {
        const text = await upstream.text().catch(() => '')
        return { text }
      })
      retryable = readUpstreamRetryable(upstreamResponse, upstream.status)
      const nestedOk =
        upstreamResponse !== null
        && typeof upstreamResponse === 'object'
        && !Array.isArray(upstreamResponse)
        && (upstreamResponse as { ok?: unknown }).ok === true
      status = upstream.ok && nestedOk ? 'completed' : 'failed'
      executed = status === 'completed'
    }

    const finalized = await db.sql`
      UPDATE keepr_workflow_checkpoints
      SET
        status = ${status},
        response_json = ${JSON.stringify(upstreamResponse)}::jsonb,
        updated_at = NOW()
      WHERE workflow = ${workflow}
        AND checkpoint_key = ${checkpointKey}
        AND status = 'processing'
        AND response_json->'claim'->>'attemptToken' = ${attemptToken}
      RETURNING status;
    `
    if (finalized.rows.length === 0) {
      if (controlPlaneActive && stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: 'manual_review',
          reason: 'checkpoint_claim_lost',
          actor: 'keeper',
          errorMessage: 'Checkpoint claim changed before reconcile could finalize',
        })
      }
      return res.status(409).json({
        success: false,
        error: 'solana_reconcile_claim_conflict',
        data: {
          workflow,
          action,
          checkpointKey,
          status: 'failed',
          executed: false,
          retryable: true,
          ...(upstreamStatusCode !== undefined ? { upstreamStatusCode } : {}),
          upstreamResponse: { reason: 'checkpoint_claim_lost' },
        },
      } satisfies ApiEnvelope<ReconcileResult>)
    }
    if (status === 'completed') {
      if (controlPlaneActive && stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: 'succeeded',
          reason: 'solana_reconcile_completed',
          actor: 'keeper',
        })
      }
      if (controlPlaneActive) {
        await completeControlPlaneOperation({
          operationId: operation.operationId,
          status: 'succeeded',
          result: {
            workflow,
            action,
            checkpointKey,
            executed,
            status,
          },
          actor: 'keeper',
        })
      }
    } else {
      const failStatus = status === 'failed' ? 'failed' : 'manual_review'
      const errorCode =
        status === 'skipped_unconfigured'
          ? 'solana_orchestrator_not_configured'
          : 'solana_reconcile_not_completed'
      const errorMessage =
        status === 'skipped_unconfigured'
          ? 'SOLANA_ORCHESTRATOR_URL is not set on the Vercel deployment'
          : typeof upstreamResponse === 'string'
            ? upstreamResponse
            : JSON.stringify(upstreamResponse ?? {})
      if (controlPlaneActive && stageId) {
        await transitionStageStatus({
          stageId,
          nextStatus: failStatus,
          reason: errorCode,
          actor: 'keeper',
          errorMessage:
            status === 'skipped_unconfigured'
              ? errorMessage
              : String(upstreamStatusCode ?? 'upstream_unavailable'),
        })
      }
      if (controlPlaneActive) {
        if (failStatus === 'failed') {
          await completeControlPlaneOperation({
            operationId: operation.operationId,
            status: 'failed',
            errorCode,
            errorMessage,
            actor: 'keeper',
          })
        } else {
          await transitionOperationStatus({
            operationId: operation.operationId,
            nextStatus: 'manual_review',
            reason: errorCode,
            actor: 'keeper',
            errorCode,
            errorMessage,
          })
        }
      }
    }

    const result: ReconcileResult = {
      workflow,
      action,
      checkpointKey,
      status,
      executed,
      ...(upstreamStatusCode !== undefined ? { upstreamStatusCode } : {}),
      ...(upstreamResponse !== null ? { upstreamResponse } : {}),
      ...(status === 'completed' ? {} : { retryable: retryable ?? true }),
    }

    console.info('[keeper/solana/reconcile] completed', {
      workflow,
      action,
      checkpointKey,
      status: result.status,
      executed: result.executed,
      orchestratorConfigured: Boolean(solanaOrchestratorUrl),
      upstreamStatusCode: result.upstreamStatusCode ?? null,
      operationId: controlPlaneActive ? operation.operationId : null,
      operationReused: operation.reused,
      resumedFromTerminal,
    })

    if (status !== 'completed') {
      return res.status(503).json({
        success: false,
        error:
          status === 'skipped_unconfigured'
            ? 'solana_orchestrator_not_configured'
            : 'solana_reconcile_not_completed',
        data: result,
      } satisfies ApiEnvelope<ReconcileResult>)
    }

    return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<ReconcileResult>)
  } catch (err) {
    console.error('[keeper/solana/reconcile] Error:', err)
    return res.status(500).json({
      success: false,
      error: 'solana_reconcile_failed',
    } satisfies ApiEnvelope<never>)
  }
}
