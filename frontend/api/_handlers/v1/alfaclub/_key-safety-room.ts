import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import {
  listKeySafetyRooms,
  resolveKeySafetyRoomContext,
} from '../../../../server/_lib/alfaclub/keySafetyRoomContext.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function parseString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(value)) return parseString(value[0] ?? null)
  return null
}

function parseLimit(value: unknown): number {
  const parsed = parseString(value)
  if (!parsed) return 40
  const n = Number(parsed)
  if (!Number.isFinite(n)) return 40
  return Math.min(80, Math.max(5, Math.floor(n)))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-key-safety-room', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const roomId = parseString(req.query.roomId)
  try {
    if (!roomId) {
      const rows = await listKeySafetyRooms(parseLimit(req.query.limit))
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180')
      return res.status(200).json({
        success: true,
        data: { rows },
      })
    }

    const context = await resolveKeySafetyRoomContext(roomId, {
      tradingWalletOverride: parseString(req.query.tradingWallet),
    })
    if (!context) {
      return res.status(404).json({ success: false, error: 'room_not_found' })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120')
    return res.status(200).json({
      success: true,
      data: { room: context },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'key_safety_room_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
