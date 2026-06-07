import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { readRoomLabelStatus } from '../../../../server/_lib/alfaclub/roomLabelCache.js'

declare const process: { env: Record<string, string | undefined> }

function readCronSecret(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return String(header[0] ?? '')
  if (typeof header === 'string' && header.trim().length > 0) return header.trim()

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function readConfiguredCronSecret(): string {
  return (process.env.CRON_SECRET ?? '').trim()
}

function parseRoomIds(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return [
    ...new Set(
      values
        .flatMap((value) => String(value).split(','))
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value)),
    ),
  ]
}

function defaultRoomIds(): string[] {
  const raw = (process.env.ALFACLUB_ROOM_LABEL_STATUS_ROOMS ?? '2,50,84,19,97').trim()
  const parsed = parseRoomIds(raw)
  if (parsed.length > 0) return parsed
  return ['2', '50', '84', '19', '97']
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = readConfiguredCronSecret()
  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: 'CRON_SECRET is not configured',
    })
  }

  const providedSecret = readCronSecret(req)
  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-room-label-status', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const roomIds =
    parseRoomIds(typeof req.query.rooms === 'string' ? req.query.rooms : '') || defaultRoomIds()
  const targetRooms = roomIds.length > 0 ? roomIds : defaultRoomIds()

  try {
    const rows = await readRoomLabelStatus(targetRooms)
    const fresh = rows.filter((row) => row.isFresh && row.displayLabel).length
    return res.status(200).json({
      success: true,
      data: {
        requestedRooms: targetRooms,
        coverage: {
          total: targetRooms.length,
          fresh,
          ratio: targetRooms.length > 0 ? fresh / targetRooms.length : 0,
        },
        rows,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
