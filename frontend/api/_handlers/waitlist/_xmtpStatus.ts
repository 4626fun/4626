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
import { formatWaitlistChatJoinError } from '../../../server/_lib/waitlist/waitlistChatErrors.js'

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

async function buildServiceUnavailablePayload(): Promise<WaitlistXmtpStatusResponse> {
  try {
    const groupResolution = await resolveWaitlistGroupId()
    const vaultConfigured = await isWaitlistChatVaultConfigured()
    const groupId = groupResolution.groupId
    const configured = Boolean(groupId)
    return {
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
      executionTrack: 'none-yet',
      canonicalCswAddress: null,
      xmtpMemberAddress: null,
      joinBlockedReason: 'service_unavailable',
      joinAction: null,
    }
  } catch {
    return {
      configured: false,
      vaultConfigured: false,
      groupId: null,
      envGroupId: null,
      vaultGroupId: null,
      groupIdSource: null,
      groupIdMismatch: false,
      groupName: getWaitlistGroupName(),
      chatReady: false,
      canJoin: false,
      executionTrack: 'none-yet',
      canonicalCswAddress: null,
      xmtpMemberAddress: null,
      joinBlockedReason: 'service_unavailable',
      joinAction: null,
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  let authorizedPrincipal: Awaited<ReturnType<typeof resolveAuthorizedRequestPrincipal>>
  try {
    authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  } catch {
    return res.status(200).json({
      success: true,
      data: await buildServiceUnavailablePayload(),
    } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
  }
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

  let groupResolution: Awaited<ReturnType<typeof resolveWaitlistGroupId>>
  let vaultConfigured: boolean
  let configured: boolean
  let groupId: string | null
  try {
    groupResolution = await resolveWaitlistGroupId()
    groupId = groupResolution.groupId
    vaultConfigured = await isWaitlistChatVaultConfigured()
    configured = Boolean(groupId)
  } catch {
    return res.status(200).json({
      success: true,
      data: await buildServiceUnavailablePayload(),
    } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
  }

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

  let eligibility: Awaited<ReturnType<typeof resolveWaitlistChatEligibility>>
  let joinAction: Awaited<ReturnType<typeof readWaitlistChatJoinAction>> | null = null
  try {
    eligibility = await resolveWaitlistChatEligibility(db, authorizedPrincipal.profileId)
    joinAction =
      groupId && eligibility.xmtpMemberAddress
        ? await readWaitlistChatJoinAction(
            db,
            buildWaitlistChatDedupeKey(groupId, eligibility.xmtpMemberAddress),
          )
        : null
  } catch {
    return res.status(200).json({
      success: true,
      data: await buildServiceUnavailablePayload(),
    } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
  }

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
            lastError: formatWaitlistChatJoinError(joinAction.lastError, joinAction.status),
          }
        : null,
    },
  } satisfies ApiEnvelope<WaitlistXmtpStatusResponse>)
}
