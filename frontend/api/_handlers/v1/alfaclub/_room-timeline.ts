import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { buildRoomTimelineData } from '../../../../server/_lib/alfaclub/roomTimeline.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

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

  try {
    const data = await buildRoomTimelineData({
      roomId,
      hostAddress: parseStringQuery(req.query.hostAddress),
      symbol: parseStringQuery(req.query.symbol),
      interval: parseStringQuery(req.query.interval),
      windowHours: parseNumberQuery(req.query.windowHours),
    })
    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=180')
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'room_timeline_failed'
    return res.status(500).json({ success: false, error: message })
  }
}

