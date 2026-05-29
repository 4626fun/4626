/**
 * Operator-only diagnostic — resolve the Privy server walletId for an EOA on a
 * given Privy DID. Used to determine whether a stranded Coinbase Smart Wallet
 * (sole owner is a rotated-out Privy embedded EOA) can still be signed for via
 * Privy's server-side wallet API.
 *
 * POST /api/admin/recover-stranded-csw/resolve-owner
 *
 * Auth: `Authorization: Bearer <ADMIN_API_TOKEN>` (same gate as
 * /api/admin/arch-b/sub-account/provision).
 *
 * Body:
 *   {
 *     privyUserId: string,   // 'did:privy:...'
 *     ownerEoa: `0x${string}`
 *   }
 *
 * Responses:
 *   200 { success: true, data: { status, privyUserId, ownerEoa, walletId?, chainType?, walletClientType?, hdWalletIndex?, delegated?, inspected? } }
 *   400 invalid_body
 *   401 admin_token_missing | admin_token_invalid
 *   500 privy_not_configured | privy_get_user_failed
 *
 * Read-only: never mutates DB, never signs anything, never enqueues jobs. Pure
 * lookup against Privy's user-by-id endpoint.
 */

import { PrivyClient } from '@privy-io/server-auth'
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
  logger,
  requireAdminApiToken,
} from '@4626/server-core'
import { resolveOwnerWalletId } from '../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'

declare const process: { env: Record<string, string | undefined> }

const BODY_MAX_BYTES = 4_096
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DID_RE = /^did:privy:[A-Za-z0-9_-]+$/

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

  if (!requireAdminApiToken(req, res)) return

  const rate = checkRateLimit(
    rateLimitKey('admin-recover-stranded-csw-resolve', getClientIp(req) || 'no-ip', 'token'),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: BODY_MAX_BYTES }).catch(
    () => null,
  )
  const body = asObjectBody(rawBody)

  const privyUserId = typeof body.privyUserId === 'string' ? body.privyUserId.trim() : ''
  const ownerEoaRaw = typeof body.ownerEoa === 'string' ? body.ownerEoa.trim() : ''

  if (!DID_RE.test(privyUserId) || !ADDRESS_RE.test(ownerEoaRaw)) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_body' } satisfies ApiEnvelope<never>)
  }

  const ownerEoa = ownerEoaRaw.toLowerCase()

  const appId = (process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    logger.error('[admin/recover-stranded-csw/resolve-owner] Privy server auth not configured')
    return res
      .status(500)
      .json({ success: false, error: 'privy_not_configured' } satisfies ApiEnvelope<never>)
  }

  let privyUser: unknown
  try {
    const privyClient = new PrivyClient(appId, appSecret)
    privyUser = await privyClient.getUserById(privyUserId)
  } catch (error) {
    logger.error('[admin/recover-stranded-csw/resolve-owner] getUserById failed', {
      privyUserId,
      err: error instanceof Error ? error.message : String(error),
    })
    return res
      .status(500)
      .json({ success: false, error: 'privy_get_user_failed' } satisfies ApiEnvelope<never>)
  }

  const outcome = resolveOwnerWalletId(privyUser, ownerEoa)

  if (outcome.status === 'ready') {
    return res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        privyUserId,
        ownerEoa: outcome.candidate.address,
        walletId: outcome.candidate.id,
        chainType: outcome.candidate.chainType,
        walletClientType: outcome.candidate.walletClientType,
        hdWalletIndex: outcome.candidate.hdWalletIndex,
        delegated: outcome.candidate.delegated,
        rawType: outcome.candidate.rawType,
      },
    } satisfies ApiEnvelope<unknown>)
  }

  if (outcome.status === 'no_server_id') {
    return res.status(200).json({
      success: true,
      data: {
        status: 'no_server_id',
        privyUserId,
        ownerEoa,
        matches: outcome.matches,
        explanation:
          'Wallet exists on the user but Privy did not surface a server walletId. ' +
          'It is likely an injected/external wallet that was linked but is not a Privy-managed embedded wallet, ' +
          'or the embedded wallet is not on the unified-wallets stack / not delegated.',
      },
    } satisfies ApiEnvelope<unknown>)
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'no_match',
      privyUserId,
      ownerEoa,
      inspected: outcome.inspected,
      explanation:
        'No wallet surface on the Privy user matches this EOA. ' +
        'The EOA has been detached from the user and cannot be signed for via this Privy app.',
    },
  } satisfies ApiEnvelope<unknown>)
}
