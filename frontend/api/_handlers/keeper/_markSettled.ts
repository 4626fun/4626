/**
 * POST /api/keeper/mark-settled
 *
 * Records graduation and/or settlement timestamps for a vault in the DB.
 * Called by keeper workflows after detecting graduation or completing sweep.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  requireOptionalHeaderEnvAuth,
  setCors,
  setNoStore,
  isDbConfigured,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import {
  createVaultControlPlane,
  VaultControlPlaneError,
} from '../../../server/_lib/controlPlane/vaultControlPlane.js'
import { SWEEP_COMPLETION_AUTHORITY } from '../../../server/_lib/controlPlane/executors/executeSettleVault.js'
import {
  requestsCompletedSettlement,
  SWEEP_COMPLETION_AUTH_ENV_KEY,
  SWEEP_COMPLETION_AUTH_HEADER,
} from '../../../server/_lib/controlPlane/settlementAuthorityAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-mark-settled', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
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
    settledAtAuthority?: string
  } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  const graduatedAt = typeof body?.graduatedAt === 'string' ? body.graduatedAt.trim() : ''
  const settledAt = typeof body?.settledAt === 'string' ? body.settledAt.trim() : ''
  const settlementStage = typeof body?.settlementStage === 'string' ? body.settlementStage.trim() : ''
  const completedSettlement = requestsCompletedSettlement({ settledAt, settlementStage })
  if (
    completedSettlement
    && !requireOptionalHeaderEnvAuth(req, res, {
      envKey: SWEEP_COMPLETION_AUTH_ENV_KEY,
      headerName: SWEEP_COMPLETION_AUTH_HEADER,
      unauthorizedError: 'Unauthorized sweep completion authority',
    })
  ) {
    return
  }
  // The authority is derived from the separate machine-authenticated lane,
  // never from the caller-controlled JSON body.
  const settledAtAuthority = completedSettlement ? SWEEP_COMPLETION_AUTHORITY : undefined

  try {
    if (!isDbConfigured()) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }
    const controlPlane = createVaultControlPlane()
    const result = await controlPlane.settleVault({
      vaultAddress,
      graduatedAt,
      settledAt,
      settlementStage,
      settledAtAuthority,
      requestedBy: 'api:keeper/mark-settled',
    })

    return res.status(202).json({
      success: true,
      data: {
        accepted: result.accepted,
        operationId: result.operationId,
        stageId: result.stageId ?? null,
      },
    } satisfies ApiEnvelope<{ accepted: boolean; operationId: string; stageId: string | null }>)
  } catch (err) {
    if (err instanceof VaultControlPlaneError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
      } satisfies ApiEnvelope<never>)
    }
    console.error('[keeper/mark-settled] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
