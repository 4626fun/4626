/**
 * Architecture B — user-facing sub-account spend-permission revoke.
 *
 * POST /api/arch-b/sub-account/revoke
 *
 * SIWE-gated. Flips `spend_permission_revoked_at` on the user's
 * command_issuer_execution_context row. The submitter's preflight
 * (`userOperationSubmitter.ts`) treats a revoked spend permission as
 * a hard refusal via the `spend_permission_revoked` code, so the net
 * effect is that /coin buy, /coin sell, /keepr send, and
 * /coin trend reserve will all refuse until the user re-provisions.
 *
 * Design notes:
 *  - DB-first by design. On-chain revoke (a UserOp calling
 *    `SpendPermissionManager.revoke(permission)` from the sub-account)
 *    is deferred to a v1.1 follow-up — see the rollout decision in
 *    `docs/design/sub-account-lifecycle-spec.md` § Decisions. The DB
 *    flip is sufficient because our backend is the only party that
 *    can co-sign UserOps from the sub-account. A user who no longer
 *    trusts our backend should use the broader `/api/arch-b/revoke`
 *    (revokes the Privy quorum delegation too).
 *  - Idempotent. Calling a second time returns `{ alreadyRevoked: true }`
 *    without re-updating the timestamp.
 *
 * Body (optional, max 8 KB):
 *   { reason?: string }   // clamped to 256 chars for audit; default 'user_revoked_spend_permission'
 *
 * Responses:
 *   200 { success: true, data: { profileId, revokedAt, alreadyRevoked, reason } }
 *   400 profile_not_ready
 *   401 unauthenticated
 *   404 not_provisioned | context_row_missing
 *   429 rate_limited
 *   503 db_unavailable
 *   500 db_write_failed
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
  logger,
} from '../../../packages/server-core/src/index.js'
import { revokeSubAccountSpendPermission } from '../../../server/_lib/wallet/commandIssuerContext.js'

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
    rateLimitKey('arch-b-subacct-revoke', principal.address, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, {
    maxBytes: REVOKE_BODY_MAX_BYTES,
  }).catch(() => null)
  const body = asObjectBody(rawBody)
  const rawReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 256) : ''
  const reason = rawReason || 'user_revoked_spend_permission'

  const outcome = await revokeSubAccountSpendPermission({ profileId: principal.profileId })
  if (!outcome.ok) {
    const statusCode =
      outcome.error === 'db_unavailable'
        ? 503
        : outcome.error === 'not_provisioned' || outcome.error === 'context_row_missing'
          ? 404
          : 500
    logger.info('[arch-b/subacct/revoke] refused', {
      profileId: principal.profileId,
      error: outcome.error,
    })
    return res
      .status(statusCode)
      .json({ success: false, error: outcome.error } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      profileId: principal.profileId,
      revokedAt: new Date().toISOString(),
      alreadyRevoked: outcome.alreadyRevoked,
      reason,
    },
  } satisfies ApiEnvelope<unknown>)
}
