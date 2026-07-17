import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getSessionAddress,
  guardAgentApiRequest,
  handleOptions,
  rateLimitKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'
import { buildRoomTimelineData } from '../../../../server/_lib/alfaclub/roomTimeline.js'

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

/**
 * Room timeline for /positions.
 *
 * Candles + trade overlays stay world-readable.
 * Chat message text (`chatEvents`) is only returned for authenticated sessions —
 * anonymous callers always get `chatEvents: []`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)

  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/alfaclub/room-timeline',
    kind: 'read',
  })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-room-timeline', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const roomId = parseStringQuery(req.query.roomId)
  if (!roomId) {
    return res.status(400).json({ success: false, error: 'roomId is required' })
  }

  const includeChat = Boolean(
    normalizeChatAddress(g.auth?.address) ?? normalizeChatAddress(getSessionAddress(req)),
  )

  try {
    const data = await buildRoomTimelineData({
      roomId,
      hostAddress: parseStringQuery(req.query.hostAddress),
      symbol: parseStringQuery(req.query.symbol),
      interval: parseStringQuery(req.query.interval),
      windowHours: parseNumberQuery(req.query.windowHours),
      includeChat,
    })
    res.setHeader(
      'Cache-Control',
      includeChat
        ? 'private, no-store'
        : 'public, s-maxage=45, stale-while-revalidate=180',
    )
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'room_timeline_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
