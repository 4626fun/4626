/**
 * Architecture B Phase 2 — user self-service revoke endpoint.
 *
 * POST /api/arch-b/revoke
 *
 * Soft-revokes the calling user's command issuer execution context.
 * The row is retained for audit, but isExecutionReady() returns false
 * after revocation. The user may re-enroll via POST /api/arch-b/enroll.
 *
 * Body (optional, max 8 KB):
 *   { reason?: string }  // clamped to 256 chars, default 'user_revoked'
 *
 * Responses:
 *   200 { success: true, data: { profileId, revokedAt, reason } }
 *   401 unauthenticated
 *   400 profile_not_ready
 *   503 db error
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  readBoundedJsonObjectBody,
  resolveAuthorizedRequestPrincipal,
} from '../../../packages/server-core/src/index.js'
import { revokeCommandIssuerContext } from '../../../server/_lib/wallet/commandIssuerContext.js'

const REVOKE_BODY_MAX_BYTES = 8_192

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = await resolveAuthorizedRequestPrincipal(req, { lowercase: true })
  if (!principal) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!principal.profileId) {
    return res
      .status(400)
      .json({ success: false, error: 'profile_not_ready' } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('arch-b-revoke', principal.address, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: REVOKE_BODY_MAX_BYTES }).catch(
    () => null,
  )
  const body = asObjectBody(rawBody)
  const rawReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 256) : ''
  const reason = rawReason || 'user_revoked'

  const { profileId } = principal

  const outcome = await revokeCommandIssuerContext({ profileId, reason })
  if (!outcome.ok) {
    const statusCode = outcome.error === 'db_unavailable' ? 503 : 500
    return res
      .status(statusCode)
      .json({ success: false, error: outcome.error } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      profileId,
      revokedAt: new Date().toISOString(),
      reason,
    },
  } satisfies ApiEnvelope<unknown>)
}
