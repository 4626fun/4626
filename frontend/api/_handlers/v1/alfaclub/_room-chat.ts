import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  checkRateLimit,
  getClientIp,
  getSessionAddress,
  guardAgentApiRequest,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'
import {
  listAlfaClubRoomChatMessages,
  type AlfaClubRoomChatMessage,
} from '../../../../server/_lib/alfaclub/chatIngestStore.js'
import {
  readAlfaClubChatBridgeFlags,
  sendAlfaClubRoomText,
} from '../../../../server/_lib/alfaclub/chatBridge.js'
import {
  claimAlfaClubCrossChannelIngress,
  linkAlfaClubCrossChannelIngress,
} from '../../../../server/_lib/alfaclub/crossChannelIngress.js'
import { readAlfaClubRoomAccessMembership } from '../../../../server/_lib/alfaclub/roomAccessPolicy.js'
import { resolveRoomChatViewAccess } from '../../../../server/_lib/alfaclub/roomChatViewAccess.js'
import { readAlfaClubRoomChannelBinding } from '../../../../server/_lib/alfaclub/roomChannelBindings.js'
import { resolveAuthorizedWalletProfile } from '../../../../server/_lib/wallet/canonicalWalletResolver.js'

function parseStringQuery(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(value)) return parseStringQuery(value[0] ?? null)
  return null
}

function parseNumberQuery(value: unknown): number | null {
  const asString = parseStringQuery(value)
  if (!asString) return null
  const n = Number(asString)
  return Number.isFinite(n) ? n : null
}

function parseBodyString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

function channelFlagsFromBinding(binding: Awaited<ReturnType<typeof readAlfaClubRoomChannelBinding>>) {
  if (!binding) {
    return {
      enabled: false,
      telegramEnabled: false,
      xmtpEnabled: false,
      rolloutStatus: null as string | null,
    }
  }
  return {
    enabled: binding.enabled && binding.rolloutStatus !== 'disabled',
    telegramEnabled: binding.telegram.enabled,
    xmtpEnabled: binding.xmtp.enabled,
    rolloutStatus: binding.rolloutStatus,
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/alfaclub/room-chat', kind: 'read' })
  if (!g.ok) return

  const requesterAddress = normalizeChatAddress(g.auth?.address) ?? normalizeChatAddress(getSessionAddress(req))
  if (!requesterAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1/alfaclub/room-chat', requesterAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.read,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const roomId = parseStringQuery(req.query.roomId)
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })

  const chatAccess = await resolveRoomChatViewAccess({
    roomId,
    sessionAddress: requesterAddress,
  })
  if (!chatAccess.allowed) {
    return res.status(403).json({
      success: false,
      error: 'room_access_required',
      chatAccess,
    })
  }

  const limit = parseNumberQuery(req.query.limit)
  const beforeMessageId = parseStringQuery(req.query.beforeMessageId)
  const beforeDateMs = parseNumberQuery(req.query.beforeDateMs)

  try {
    const [messages, binding] = await Promise.all([
      listAlfaClubRoomChatMessages({
        roomId,
        limit: limit ?? undefined,
        beforeMessageId,
        beforeDateMs,
      }),
      readAlfaClubRoomChannelBinding(roomId),
    ])

    return res.status(200).json({
      success: true,
      data: {
        roomId,
        messages,
        channels: channelFlagsFromBinding(binding),
        chatAccess,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'room_chat_list_failed'
    const status = message.includes('db_not_configured') ? 503 : 500
    return res.status(status).json({ success: false, error: message })
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/alfaclub/room-chat', kind: 'write' })
  if (!g.ok) return

  const requesterAddress =
    normalizeChatAddress(g.auth?.address) ?? normalizeChatAddress(getSessionAddress(req))
  if (!requesterAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const roomId = parseBodyString(body.roomId, 128)
  const text = parseBodyString(body.text, 20_000)
  const clientMessageId = parseBodyString(body.clientMessageId, 512)
  const replyToMessageId = parseBodyString(body.replyToMessageId, 512)

  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })
  if (!text) return res.status(400).json({ success: false, error: 'text is required' })
  if (!clientMessageId) {
    return res.status(400).json({ success: false, error: 'clientMessageId is required' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-alfaclub-room-chat-write', requesterAddress, roomId, getClientIp(req)),
    RATE_LIMITS.workspaceActions,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const authority = await resolveAuthorizedWalletProfile(requesterAddress).catch(() => null)
  const canonicalIssuer = authority?.canonicalSmartWalletAddress?.toLowerCase() ?? null
  if (!authority || !canonicalIssuer || !/^0x[a-f0-9]{40}$/.test(canonicalIssuer)) {
    return res.status(403).json({ success: false, error: 'issuer_unavailable' })
  }

  const membership = await readAlfaClubRoomAccessMembership({
    roomId,
    walletAddress: canonicalIssuer as `0x${string}`,
  })
  if (!membership || membership.status !== 'active') {
    return res.status(403).json({ success: false, error: 'membership_required' })
  }

  const claim = await claimAlfaClubCrossChannelIngress({
    sourceChannel: 'web4626',
    sourceMessageId: clientMessageId,
    sourceConversationId: `web4626:${roomId}`,
    targetRoomId: roomId,
    originalText: text,
  })
  if (!claim) {
    return res.status(503).json({ success: false, error: 'ingress_claim_unavailable' })
  }
  if (!claim.claimed) {
    return res.status(409).json({ success: false, error: 'duplicate_client_message_id' })
  }

  try {
    const send = await sendAlfaClubRoomText({
      roomId,
      text,
      replyToMessageId: replyToMessageId ?? undefined,
      clientMessageId: `web4626:${roomId}:${clientMessageId}`,
      flags: readAlfaClubChatBridgeFlags(),
      origin: 'web4626',
    })
    if (!send.messageId) {
      return res.status(502).json({ success: false, error: 'room_message_id_missing', data: { lane: send.lane } })
    }

    const linked = await linkAlfaClubCrossChannelIngress({
      sourceChannel: 'web4626',
      sourceMessageId: clientMessageId,
      alfaclubRoomId: roomId,
      alfaclubMessageId: send.messageId,
      validatedProfileId: authority.profileId,
      validatedIssuer: canonicalIssuer,
    })
    if (!linked) {
      return res.status(503).json({
        success: false,
        error: 'ingress_link_unavailable',
        data: { messageId: send.messageId, lane: send.lane },
      })
    }

    const message: Pick<AlfaClubRoomChatMessage, 'roomId' | 'messageId' | 'text' | 'origin'> & {
      lane: string
      clientMessageId: string
      replyToMessageId: string | null
    } = {
      roomId,
      messageId: send.messageId,
      text,
      origin: 'web4626',
      lane: send.lane,
      clientMessageId,
      replyToMessageId: replyToMessageId ?? null,
    }

    return res.status(200).json({
      success: true,
      data: {
        message,
        issuer: canonicalIssuer,
        membershipStatus: membership.status,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'room_chat_send_failed'
    return res.status(502).json({ success: false, error: message.slice(0, 220) })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)

  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return res.status(405).json({ success: false, error: 'Method not allowed' })
}
