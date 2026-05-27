import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  getDb,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  resolveAuthorizedRequestPrincipal,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { executeKeeprAction } from '../../../server/keepr/xmtpQueueExecutor.js'
import {
  isWaitlistChatVaultConfigured,
  resolveWaitlistGroupId,
  resolveWaitlistChatEligibility,
  WAITLIST_CHAT_VAULT_ADDRESS,
} from '../../../server/_lib/waitlist/waitlistXmtpChat.js'

type WaitlistXmtpResyncResponse = {
  groupId: string
  identityAddress: `0x${string}`
  reapplied: boolean
  error: string | null
}

function joinBlockedStatusCode(reason: string | null): number {
  switch (reason) {
    case 'owner_check_failed':
      return 502
    case 'canonical_csw_missing':
    case 'embedded_eoa_missing':
      return 409
    case 'sub_account_not_registered':
    case 'embedded_owner_not_installed':
      return 403
    default:
      return 403
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  if (!authorizedPrincipal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('waitlist-xmtp-resync', String(authorizedPrincipal.profileId), getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const groupResolution = await resolveWaitlistGroupId()
  const groupId = groupResolution.groupId
  if (!groupId) {
    return res.status(503).json({
      success: false,
      error: 'waitlist_chat_not_configured',
    } satisfies ApiEnvelope<never>)
  }

  if (!(await isWaitlistChatVaultConfigured())) {
    return res.status(503).json({
      success: false,
      error: 'waitlist_chat_vault_not_configured',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  const eligibility = await resolveWaitlistChatEligibility(db, authorizedPrincipal.profileId)
  const { joinBlockedReason, xmtpMemberAddress, executionTrack } = eligibility

  if (!eligibility.chatReady || !xmtpMemberAddress || joinBlockedReason) {
    return res.status(joinBlockedStatusCode(joinBlockedReason)).json({
      success: false,
      error: joinBlockedReason ?? 'chat_not_ready',
    } satisfies ApiEnvelope<never>)
  }

  if (executionTrack !== 'legacy-owner-install' && executionTrack !== 'sub-account') {
    return res.status(403).json({
      success: false,
      error: 'chat_not_ready',
    } satisfies ApiEnvelope<never>)
  }

  const actionPayload = {
    action: 'xmtp.group.add_member',
    wallet: xmtpMemberAddress,
    reason: 'waitlist_browser_resync',
  }

  const result = await executeKeeprAction({
    id: 0,
    vaultAddress: WAITLIST_CHAT_VAULT_ADDRESS,
    groupId,
    actionType: 'xmtp.group.add_member',
    action: actionPayload,
  })

  return res.status(result.success ? 200 : 502).json({
    success: result.success,
    data: {
      groupId,
      identityAddress: xmtpMemberAddress,
      reapplied: result.success,
      error: result.success ? null : (result.error ?? 'resync_failed'),
    },
    ...(result.success ? {} : { error: result.error ?? 'resync_failed' }),
  } satisfies ApiEnvelope<WaitlistXmtpResyncResponse>)
}
