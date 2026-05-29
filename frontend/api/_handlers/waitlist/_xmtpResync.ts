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
} from '@4626/server-core'
import { enqueueKeeprAction } from '../../../server/_lib/keepr/keeprRegistry.js'
import {
  isWaitlistChatVaultConfigured,
  resolveWaitlistGroupId,
  resolveWaitlistChatEligibility,
  WAITLIST_CHAT_VAULT_ADDRESS,
} from '../../../server/_lib/waitlist/waitlistXmtpChat.js'
import {
  buildWaitlistChatDedupeKey,
  readWaitlistChatJoinAction,
} from '../../../server/_lib/waitlist/waitlistXmtpChatJoinExecution.js'

type WaitlistXmtpResyncResponse = {
  groupId: string
  identityAddress: `0x${string}`
  reapplied: boolean
  queued: boolean
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
  const dedupeKey = buildWaitlistChatDedupeKey(groupId, xmtpMemberAddress)

  const existingJoin = await readWaitlistChatJoinAction(db, dedupeKey)
  if (existingJoin?.status === 'executed') {
    return res.status(200).json({
      success: true,
      data: {
        groupId,
        identityAddress: xmtpMemberAddress,
        reapplied: false,
        queued: false,
        error: null,
      },
    } satisfies ApiEnvelope<WaitlistXmtpResyncResponse>)
  }

  if (
    existingJoin?.status === 'pending' ||
    existingJoin?.status === 'executing' ||
    existingJoin?.status === 'retry'
  ) {
    return res.status(200).json({
      success: true,
      data: {
        groupId,
        identityAddress: xmtpMemberAddress,
        reapplied: false,
        queued: true,
        error: null,
      },
    } satisfies ApiEnvelope<WaitlistXmtpResyncResponse>)
  }

  await enqueueKeeprAction({
    vaultAddress: WAITLIST_CHAT_VAULT_ADDRESS,
    groupId,
    actionType: 'xmtp.group.add_member',
    action: actionPayload,
    dedupeKey,
  })

  return res.status(200).json({
    success: true,
    data: {
      groupId,
      identityAddress: xmtpMemberAddress,
      reapplied: false,
      queued: true,
      error: null,
    },
  } satisfies ApiEnvelope<WaitlistXmtpResyncResponse>)
}
