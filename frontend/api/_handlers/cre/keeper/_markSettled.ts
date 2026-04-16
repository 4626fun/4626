/**
 * POST /api/cre/keeper/mark-settled
 *
 * Records graduation and/or settlement timestamps for a vault in the DB.
 * Called by CRE workflows after detecting graduation or completing sweep.
 *
 * Protected by KEEPR_API_KEY Bearer token.
 *
 * Request body:
 * {
 *   vaultAddress: string,
 *   graduatedAt?: string,
 *   settledAt?: string,
 *   settlementStage?: string
 * }
 *
 * Enforces audit §5.1 invariant 5 at the endpoint:
 *   - `settledAt` is only accepted when `settlementStage === 'completed'`.
 *   - `settledAt` must be a valid ISO-8601 timestamp not in the future.
 *
 * This guards against a bad CRE workflow version or a compromised
 * KEEPR_API_KEY writing `settled_at` without the completion state machine
 * passing in `/api/cre/keeper/sweep`. Invariants 1-4 (trade-fee collector,
 * creator-coin payout recipient mode, creator treasury, completion chain)
 * are still verified by `/sweep` and fail closed there; this endpoint is the
 * DB writer and must not contradict that gate.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('cre-keeper-mark-settled', getClientIp(req)),
    RATE_LIMITS.creRuntimeTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as {
    vaultAddress?: string
    graduatedAt?: string
    settledAt?: string
    settlementStage?: string
  } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  const graduatedAt = typeof body?.graduatedAt === 'string' ? body.graduatedAt.trim() : ''
  const settledAt = typeof body?.settledAt === 'string' ? body.settledAt.trim() : ''
  const settlementStage = typeof body?.settlementStage === 'string' ? body.settlementStage.trim() : ''

  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const normalizedStage = typeof settlementStage === 'string' ? settlementStage.trim() : ''
  if (normalizedStage && !/^[a-z0-9_:-]{2,64}$/i.test(normalizedStage)) {
    return res.status(400).json({ success: false, error: 'Invalid settlementStage' } satisfies ApiEnvelope<never>)
  }

  if (!graduatedAt && !settledAt && !normalizedStage) {
    return res.status(400).json({
      success: false,
      error: 'Must provide graduatedAt, settledAt, or settlementStage',
    } satisfies ApiEnvelope<never>)
  }

  // Audit §5.1 invariant 5: settledAt is only written when the completion
  // state machine in /api/cre/keeper/sweep reports stage='completed'. Reject
  // any request that tries to write settledAt paired with a different stage,
  // or settledAt in the future, or a malformed timestamp.
  if (settledAt) {
    if (normalizedStage.toLowerCase() !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'settledAt may only be written when settlementStage="completed"',
      } satisfies ApiEnvelope<never>)
    }
    const parsedSettledAt = Date.parse(settledAt)
    if (!Number.isFinite(parsedSettledAt)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settledAt — expected ISO-8601 timestamp',
      } satisfies ApiEnvelope<never>)
    }
    // Allow a small amount of clock skew (5 minutes) so callers that generated
    // the timestamp slightly ahead of the server clock aren't rejected.
    const maxAllowedMs = Date.now() + 5 * 60 * 1000
    if (parsedSettledAt > maxAllowedMs) {
      return res.status(400).json({
        success: false,
        error: 'settledAt cannot be in the future',
      } satisfies ApiEnvelope<never>)
    }
  }

  if (!isDbConfigured()) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureKeeprSchema()
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
    }

    const addr = vaultAddress.toLowerCase()

    // Timestamps are one-way (COALESCE); settlement stage is latest-state and may advance.
    await db.sql`
      UPDATE keepr_vaults
      SET graduated_at = COALESCE(graduated_at, ${graduatedAt ?? null}::timestamptz),
          settled_at = COALESCE(settled_at, ${settledAt ?? null}::timestamptz),
          settlement_stage = COALESCE(${normalizedStage || null}::text, settlement_stage),
          settlement_stage_updated_at =
            CASE
              WHEN ${normalizedStage || null}::text IS NULL THEN settlement_stage_updated_at
              ELSE NOW()
            END,
          updated_at = NOW()
      WHERE LOWER(vault_address) = ${addr};
    `

    return res.status(200).json({
      success: true,
      data: {
        updated: true,
        stageUpdated: Boolean(normalizedStage),
      },
    } satisfies ApiEnvelope<{ updated: boolean; stageUpdated: boolean }>)
  } catch (err) {
    console.error('[cre/keeper/mark-settled] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
