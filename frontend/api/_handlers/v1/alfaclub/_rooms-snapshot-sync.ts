import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import {
  readRoomsSnapshotSyncFlags,
  syncRoomsSnapshot,
} from '../../../../server/_lib/alfaclub/roomsSnapshotSync.js'
import {
  readConfiguredCronSecret,
  readCronSecretFromRequest,
} from '../../../../server/_lib/alfaclub/alfaclubCronAuth.js'

function parseBool(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  const value = raw.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = readConfiguredCronSecret()
  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: 'CRON_SECRET is not configured',
    })
  }

  const providedSecret = readCronSecretFromRequest(req)
  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-rooms-snapshot-sync', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const flags = readRoomsSnapshotSyncFlags()
  if (!flags.enabled) {
    return res.status(503).json({
      success: false,
      reason: 'disabled',
      flags,
    })
  }

  const roomIds = parseRoomIds(req.query.rooms)
  const full = parseBool(typeof req.query.full === 'string' ? req.query.full : undefined)
  const skipIndexer = parseBool(typeof req.query.skipIndexer === 'string' ? req.query.skipIndexer : undefined)

  try {
    const result = await syncRoomsSnapshot({
      roomIds: roomIds.length > 0 ? roomIds : undefined,
      full,
      runIndexer: full ? !skipIndexer : undefined,
    })
    return res.status(result.ok ? 200 : 202).json({
      success: result.ok,
      data: result,
      flags,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
