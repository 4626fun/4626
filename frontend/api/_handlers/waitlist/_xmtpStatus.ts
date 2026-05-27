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
import type { WaitlistChatExecutionTrack } from '../../../server/_lib/waitlist/waitlistXmtpChatEligibility.js'
import {
  getWaitlistGroupName,
  resolveWaitlistGroupId,
  isWaitlistChatVaultConfigured,
  resolveWaitlistChatEligibility,
} from '../../../server/_lib/waitlist/waitlistXmtpChat.js'
import {
  buildWaitlistChatDedupeKey,
  readWaitlistChatJoinAction,
} from '../../../server/_lib/waitlist/waitlistXmtpChatJoinExecution.js'

type WaitlistXmtpStatusResponse = {
  configured: boolean
  vaultConfigured: boolean
  groupId: string | null
  envGroupId: string | null
  vaultGroupId: string | null
  groupIdSource: 'vault' | 'env' | null
  groupIdMismatch: boolean
  groupName: string
  chatReady: boolean
  canJoin: boolean
  executionTrack: WaitlistChatExecutionTrack
  canonicalCswAddress: string | null
  xmtpMemberAddress: string | null
  joinBlockedReason: string | null
  joinAction: {
    actionId: number
    status: 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null
    lastError: string | null
  } | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  if (!authorizedPrincipal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('waitlist-xmtp-status', String(authorizedPrincipal.profileId), getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const groupResolution = await resolveWaitlistGroupId()
  const groupId = groupResolution.groupId
  const vaultConfigured = await isWaitlistChatVaultConfigured()
  const configured = Boolean(groupId)

  const db = await getDb()
  if (!db) {
    return res.status(200).json({
      success: true,
      data: {
        configured,
        vaultConfigured,
        groupId,
        envGroupId: groupResolution.envGroupId,
        vaultGroupId: groupResolution.vaultGroupId,
        groupIdSource: groupResolution.source,
        groupIdMismatch: groupResolution.mismatched,
        groupName: getWaitlistGroupName(),
        chatReady: false,
        canJoin: false,
        executionTrack: 'none-yet' as const,
        canonicalCswAddress: null,
        xmtpMemberAddress: null,
        joinBlockedReason: 'service_unavailable',
        joinAction: null,
      },
    } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
  }

  const eligibility = await resolveWaitlistChatEligibility(db, authorizedPrincipal.profileId)
  const joinAction =
    groupId && eligibility.xmtpMemberAddress
      ? await readWaitlistChatJoinAction(
          db,
          buildWaitlistChatDedupeKey(groupId, eligibility.xmtpMemberAddress),
        )
      : null

  return res.status(200).json({
    success: true,
    data: {
      configured,
      vaultConfigured,
      groupId,
      envGroupId: groupResolution.envGroupId,
      vaultGroupId: groupResolution.vaultGroupId,
      groupIdSource: groupResolution.source,
      groupIdMismatch: groupResolution.mismatched,
      groupName: getWaitlistGroupName(),
      chatReady: eligibility.chatReady,
      canJoin: configured && vaultConfigured && eligibility.chatReady,
      executionTrack: eligibility.executionTrack,
      canonicalCswAddress: eligibility.canonicalCswAddress,
      xmtpMemberAddress: eligibility.xmtpMemberAddress,
      joinBlockedReason: eligibility.joinBlockedReason,
      joinAction: joinAction
        ? {
            actionId: joinAction.actionId,
            status: joinAction.status,
            lastError: joinAction.lastError,
          }
        : null,
    },
  } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
}
