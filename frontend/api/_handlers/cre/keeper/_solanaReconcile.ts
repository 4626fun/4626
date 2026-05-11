/**
 * POST /api/keeper/solana/reconcile
 *
 * Idempotent bridge endpoint for CRE-managed Solana orchestration.
 * The endpoint stores workflow checkpoints in Postgres to ensure retries are safe.
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
} from '../../../../packages/server-core/src/index.js'


import { ensureKeeprSchema } from '../../../../server/_lib/keepr/keeprSchema.js'

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

async function ensureSolanaCheckpointTable(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return
  await db.sql`
    CREATE TABLE IF NOT EXISTS keepr_workflow_checkpoints (
      workflow TEXT NOT NULL,
      checkpoint_key TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json JSONB,
      response_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workflow, checkpoint_key)
    );
  `
  try {
    await db.sql`ALTER TABLE keepr_workflow_checkpoints ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS cannot be enabled in this runtime.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'keepr_workflow_checkpoints'
            AND policyname = 'keepr_workflow_checkpoints_deny_all'
        ) THEN
          CREATE POLICY keepr_workflow_checkpoints_deny_all
            ON keepr_workflow_checkpoints
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore if policy creation is unavailable in this runtime.
  }
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
    rateLimitKey('cre-keeper-solana-reconcile', getClientIp(req)),
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

    await ensureSolanaCheckpointTable(db)

    const prior = await db.sql`
      SELECT status, response_json
      FROM keepr_workflow_checkpoints
      WHERE workflow = ${workflow} AND checkpoint_key = ${checkpointKey}
      LIMIT 1;
    `
    const priorRow = prior.rows[0] as { status?: string; response_json?: unknown } | undefined
    if (priorRow?.status === 'completed') {
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
    console.error('[cre/keeper/solana/reconcile] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
