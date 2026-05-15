import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  requireKeeprApiKey,
  requireOptionalHeaderEnvAuth,
  setCors,
  setNoStore,
  getDb,
  readBoundedJsonObjectBody,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../../packages/server-core/src/index.js'

import { ensureKeeprSchema } from '../../../../server/_lib/keepr/keeprSchema.js'

import { normalizeKeeprActionStatusForWorkspace } from '../../../../server/_lib/workspace/normalizer.js'
import {
  KPR_TRUST_ZONE_KEY_HEADER,
  getKeeprTrustZoneEnvKey,
  resolveKeeprEffectiveActionType,
  resolveKeeprTrustZone,
} from '../../../../server/_lib/agentControl/trustZones.js'

declare const process: { env: Record<string, string | undefined> }

type UpdateBody = {
  id: number
  status: 'executing' | 'executed' | 'failed' | 'retry'
  error?: string | null
  /** Delay before next retry (seconds). Only relevant for status='retry'. */
  retryDelaySeconds?: number
}

type UpdateResponse = {
  id: number
  status: string
  trustZone: string
  updated: boolean
}

const VALID_STATUSES = new Set(['executing', 'executed', 'failed', 'retry'])
const MAX_ATTEMPTS = 5
const UPDATE_STATUS_MAX_BODY_BYTES = 16_384

async function syncJoinRequestStatus(params: {
  db: Awaited<ReturnType<typeof getDb>>
  actionId: number
  status: 'executed' | 'failed' | 'retry'
  errorMessage: string | null
  retryDelaySeconds: number
}) {
  const { db, actionId, status, errorMessage, retryDelaySeconds } = params
  if (!db) return

  if (status === 'executed') {
    await db.sql`
      UPDATE keepr_join_requests
      SET
        status = 'added',
        last_reason = ${'executed'},
        last_checked_at = NOW(),
        next_check_at = NULL,
        updated_at = NOW()
      WHERE action_id = ${actionId}
        AND status IN ('watching', 'queued', 'failed');
    `
    return
  }

  if (status === 'failed') {
    await db.sql`
      UPDATE keepr_join_requests
      SET
        status = 'failed',
        last_reason = COALESCE(${errorMessage}, last_reason, ${'action_failed'}),
        last_checked_at = NOW(),
        next_check_at = NULL,
        updated_at = NOW()
      WHERE action_id = ${actionId}
        AND status IN ('watching', 'queued', 'failed');
    `
    return
  }

  await db.sql`
    UPDATE keepr_join_requests
    SET
      status = 'queued',
      last_reason = COALESCE(${errorMessage}, last_reason, ${'action_retry'}),
      last_checked_at = NOW(),
      next_check_at = NOW() + (${retryDelaySeconds} || ' seconds')::interval,
      updated_at = NOW()
    WHERE action_id = ${actionId}
      AND status IN ('watching', 'queued', 'failed');
  `
}

/**
 * POST /api/keepr/actions/updateStatus
 *
 * Updates the status of a keepr_actions row.
 * Protected by a shared secret (KPR_API_KEY).
 *
 * Body:
 *   - id: action ID
 *   - status: new status ('executing' | 'executed' | 'failed' | 'retry')
 *   - error: optional error message (for 'failed' or 'retry')
 *   - retryDelaySeconds: optional delay before next retry (default 60)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(rateLimitKey('keepr:actions:update-status', getClientIp(req)), RATE_LIMITS.creRuntimeDecisionsWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  try {
    const body: Partial<UpdateBody> = (await readBoundedJsonObjectBody<UpdateBody>(req, {
      maxBytes: UPDATE_STATUS_MAX_BODY_BYTES,
    })) ?? {}

    const id = Number(body.id)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid action id' } satisfies ApiEnvelope<never>)
    }

    const status = String(body.status ?? '')
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      } satisfies ApiEnvelope<never>)
    }

    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }
    await ensureKeeprSchema()

    const actionRow = await db.sql`
      SELECT action_type, action
      FROM keepr_actions
      WHERE id = ${id}
      LIMIT 1;
    `
    const row = actionRow.rows?.[0]
    const effectiveActionType = resolveKeeprEffectiveActionType(
      typeof row?.action_type === 'string' ? row.action_type : null,
      row?.action && typeof row.action === 'object' ? (row.action as Record<string, unknown>) : null,
    )
    const trustZone = resolveKeeprTrustZone(effectiveActionType)
    if (
      !requireOptionalHeaderEnvAuth(req, res, {
        envKey: getKeeprTrustZoneEnvKey(trustZone),
        headerName: KPR_TRUST_ZONE_KEY_HEADER,
        unauthorizedError: `Unauthorized trust zone: ${trustZone}`,
      })
    ) {
      return
    }

    const errorMessage = body.error ? String(body.error).slice(0, 2000) : null
    const retryDelay = Number(body.retryDelaySeconds) || 60

    if (status === 'executing') {
      // Mark as executing and bump attempt count
      const result = await db.sql`
        UPDATE keepr_actions
        SET
          status = 'executing',
          attempt_count = attempt_count + 1,
          updated_at = NOW()
        WHERE id = ${id}
          AND status IN ('pending', 'retry')
        RETURNING id;
      `
      const updated = (result.rows?.length ?? 0) > 0
      if (updated) {
        await normalizeKeeprActionStatusForWorkspace({
          actionId: id,
          status: 'executing',
          errorMessage,
        }).catch(() => undefined)
      }
      return res.status(200).json({
        success: true,
        data: { id, status, trustZone, updated },
      } satisfies ApiEnvelope<UpdateResponse>)
    }

    if (status === 'executed') {
      const result = await db.sql`
        UPDATE keepr_actions
        SET
          status = 'executed',
          executed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
          AND status = 'executing'
        RETURNING id;
      `
      const updated = (result.rows?.length ?? 0) > 0
      if (updated) {
        await syncJoinRequestStatus({
          db,
          actionId: id,
          status: 'executed',
          errorMessage,
          retryDelaySeconds: retryDelay,
        })
        await normalizeKeeprActionStatusForWorkspace({
          actionId: id,
          status: 'executed',
          errorMessage,
        }).catch(() => undefined)
      }
      return res.status(200).json({
        success: true,
        data: { id, status, trustZone, updated },
      } satisfies ApiEnvelope<UpdateResponse>)
    }

    if (status === 'failed') {
      const result = await db.sql`
        UPDATE keepr_actions
        SET
          status = 'failed',
          last_error = ${errorMessage},
          updated_at = NOW()
        WHERE id = ${id}
          AND status = 'executing'
        RETURNING id;
      `
      const updated = (result.rows?.length ?? 0) > 0
      if (updated) {
        await syncJoinRequestStatus({
          db,
          actionId: id,
          status: 'failed',
          errorMessage,
          retryDelaySeconds: retryDelay,
        })
        await normalizeKeeprActionStatusForWorkspace({
          actionId: id,
          status: 'failed',
          errorMessage,
        }).catch(() => undefined)
      }
      return res.status(200).json({
        success: true,
        data: { id, status, trustZone, updated },
      } satisfies ApiEnvelope<UpdateResponse>)
    }

    if (status === 'retry') {
      // Only retry if under max attempts
      const checkResult = await db.sql`
        SELECT attempt_count FROM keepr_actions WHERE id = ${id} LIMIT 1;
      `
      const currentAttempts = Number(checkResult.rows?.[0]?.attempt_count ?? 0)

      if (currentAttempts >= MAX_ATTEMPTS) {
        // Exceeded max retries — mark as failed
        await db.sql`
          UPDATE keepr_actions
          SET
            status = 'failed',
            last_error = ${errorMessage ?? 'Max retries exceeded'},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id;
        `
        return res.status(200).json({
          success: true,
          data: { id, status: 'failed', trustZone, updated: true },
        } satisfies ApiEnvelope<UpdateResponse>)
      }

      const result = await db.sql`
        UPDATE keepr_actions
        SET
          status = 'retry',
          last_error = ${errorMessage},
          next_attempt_at = NOW() + (${retryDelay} || ' seconds')::interval,
          updated_at = NOW()
        WHERE id = ${id}
          AND status = 'executing'
        RETURNING id;
      `
      const updated = (result.rows?.length ?? 0) > 0
      if (updated) {
        await syncJoinRequestStatus({
          db,
          actionId: id,
          status: 'retry',
          errorMessage,
          retryDelaySeconds: retryDelay,
        })
        await normalizeKeeprActionStatusForWorkspace({
          actionId: id,
          status: 'retry',
          errorMessage,
        }).catch(() => undefined)
      }
      return res.status(200).json({
        success: true,
        data: { id, status, trustZone, updated },
      } satisfies ApiEnvelope<UpdateResponse>)
    }

    return res.status(400).json({ success: false, error: 'Unhandled status' } satisfies ApiEnvelope<never>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
