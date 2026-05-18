/**
 * POST /api/keeper/solana/reconcile
 *
 * Idempotent bridge endpoint for Solana orchestration.
 * Stores workflow checkpoints in Postgres to ensure retry safety.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

import { ensureKeeprSchema } from '../../../server/_lib/keepr/keeprSchema.js'
import {
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
  upstreamStatusCode?: number
  upstreamResponse?: unknown
}

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

function resolveStageKind(action: string): string {
  if (action.includes('bridge') || action.includes('register')) return 'solana.bridge_token_registration'
  if (action.includes('meteora')) return 'solana.meteora_instruction_build'
  if (action.includes('alpha')) return 'solana.alpha_vault_create'
  if (action.includes('submit')) return 'chain.transaction_submit'
  if (action.includes('confirm')) return 'chain.confirmation_wait'
  if (action.includes('reconcile') || action.includes('checkpoint')) return 'reconcile.checkpoint'
  return 'solana.route_preflight'
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
    RATE_LIMITS.creRuntimeTriggerWrite,
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
    return res.status(200).json({
      success: true,
      data: buildSkippedResult(workflow, action, checkpointKey, 'database_not_configured'),
    } satisfies ApiEnvelope<ReconcileResult>)
  }

  try {
    await ensureKeeprSchema()
    const db = await getDb()
    if (!db) {
      return res.status(200).json({
        success: true,
        data: buildSkippedResult(workflow, action, checkpointKey, 'database_unavailable'),
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
    await transitionOperationStatus({
      operationId: operation.operationId,
      nextStatus: 'running',
      reason: 'solana_reconcile_started',
      actor: 'keeper',
    })
    const stage = await createControlPlaneStage({
      operationId: operation.operationId,
      stageKind: resolveStageKind(action),
      status: 'requested',
      input: { workflow, checkpointKey, action },
    })
    await transitionStageStatus({
      stageId: stage.stageId,
      nextStatus: 'running',
      reason: 'solana_reconcile_started',
      actor: 'keeper',
    })

    const prior = await db.sql`
      SELECT status, response_json
      FROM keepr_workflow_checkpoints
      WHERE workflow = ${workflow} AND checkpoint_key = ${checkpointKey}
      LIMIT 1;
    `
    const priorRow = prior.rows[0] as { status?: string; response_json?: unknown } | undefined
    if (priorRow?.status === 'completed') {
      await transitionStageStatus({
        stageId: stage.stageId,
        nextStatus: 'succeeded',
        reason: 'checkpoint_already_processed',
        actor: 'keeper',
      })
      await completeControlPlaneOperation({
        operationId: operation.operationId,
        status: 'succeeded',
        result: { alreadyProcessed: true, workflow, checkpointKey },
        actor: 'keeper',
      })
      const existing: ReconcileResult = {
        workflow,
        action,
        checkpointKey,
        status: 'already_processed',
        executed: false,
        upstreamResponse: priorRow.response_json,
      }
      return res.status(200).json({
        success: true,
        data: existing,
      } satisfies ApiEnvelope<ReconcileResult>)
    }

    const solanaOrchestratorUrl = (process.env.SOLANA_ORCHESTRATOR_URL ?? '').trim().replace(/\/$/, '')
    let status: ReconcileResult['status'] = 'skipped_unconfigured'
    let executed = false
    let upstreamStatusCode: number | undefined
    let upstreamResponse: unknown = null

    if (solanaOrchestratorUrl) {
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
          action,
          checkpointKey,
          payload,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      upstreamStatusCode = upstream.status
      upstreamResponse = await upstream.json().catch(async () => {
        const text = await upstream.text().catch(() => '')
        return { text }
      })
      status = upstream.ok ? 'completed' : 'failed'
      executed = upstream.ok
    }

    await db.sql`
      INSERT INTO keepr_workflow_checkpoints (
        workflow, checkpoint_key, action, status, payload_json, response_json, updated_at
      ) VALUES (
        ${workflow},
        ${checkpointKey},
        ${action},
        ${status},
        ${JSON.stringify(payload)},
        ${JSON.stringify(upstreamResponse)},
        NOW()
      )
      ON CONFLICT (workflow, checkpoint_key)
      DO UPDATE SET
        action = EXCLUDED.action,
        status = EXCLUDED.status,
        payload_json = EXCLUDED.payload_json,
        response_json = EXCLUDED.response_json,
        updated_at = NOW();
    `
    if (status === 'completed') {
      await transitionStageStatus({
        stageId: stage.stageId,
        nextStatus: 'succeeded',
        reason: 'solana_reconcile_completed',
        actor: 'keeper',
      })
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
    } else {
      const failStatus = status === 'failed' ? 'failed' : 'manual_review'
      await transitionStageStatus({
        stageId: stage.stageId,
        nextStatus: failStatus,
        reason: 'solana_reconcile_not_completed',
        actor: 'keeper',
        errorMessage: String(upstreamStatusCode ?? 'upstream_unavailable'),
      })
      await completeControlPlaneOperation({
        operationId: operation.operationId,
        status: 'failed',
        errorCode: 'solana_reconcile_not_completed',
        errorMessage: typeof upstreamResponse === 'string' ? upstreamResponse : JSON.stringify(upstreamResponse ?? {}),
        actor: 'keeper',
      })
    }

    const result: ReconcileResult = {
      workflow,
      action,
      checkpointKey,
      status,
      executed,
      ...(upstreamStatusCode !== undefined ? { upstreamStatusCode } : {}),
      ...(upstreamResponse !== null ? { upstreamResponse } : {}),
    }

    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<ReconcileResult>)
  } catch (err) {
    console.error('[keeper/solana/reconcile] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
