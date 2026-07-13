import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { resolveAlfaClubKeySafetySummary } from '../../../../server/_lib/alfaclub/keySafetySummary.js'

function parseRoomId(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  const normalized = typeof candidate === 'string' ? candidate.trim() : ''
  return /^\d+$/.test(normalized) ? normalized : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-key-safety-summary', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const roomId = parseRoomId(req.query.roomId)
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })

  try {
    const summary = await resolveAlfaClubKeySafetySummary(roomId)
    if (!summary) return res.status(404).json({ success: false, error: 'room_not_found' })
    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120')
    return res.status(200).json({ success: true, data: { summary } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'key_safety_summary_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
