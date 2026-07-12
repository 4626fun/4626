import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { listTradingRoomsDirectory } from '../../../../server/_lib/alfaclub/tradingRoomsDirectory.js'

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
  if (!parsed) return 2000
  const n = Number(parsed)
  if (!Number.isFinite(n)) return 2000
  return Math.min(2500, Math.max(1, Math.floor(n)))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-trading-rooms', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const rows = await listTradingRoomsDirectory(parseLimit(req.query.limit))
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({
      success: true,
      data: {
        total: rows.length,
        rows,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'trading_rooms_list_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
