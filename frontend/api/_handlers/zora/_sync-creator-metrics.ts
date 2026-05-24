import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  runCreatorMetricsExploreBackfill,
  runCreatorMetricsHotSync,
  runCreatorMetricsSync,
} from '../../../server/_lib/zora/creatorMetricsSync.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../packages/server-core/src/index.js'
declare const process: { env: Record<string, string | undefined> }

function readSyncMode(req: VercelRequest): 'hot' | 'explore' | 'backfill' {
  const raw = req.query?.mode
  const value = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : ''
  const normalized = value.trim().toLowerCase()
  if (normalized === 'hot') return 'hot'
  if (normalized === 'explore') return 'explore'
  return 'backfill'
}

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

function readBooleanQuery(req: VercelRequest, key: string): boolean {
  const raw = req.query?.[key]
  const value = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : ''
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function readNumberQuery(req: VercelRequest, key: string): number | undefined {
  const raw = req.query?.[key]
  const value = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : ''
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.floor(n)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = (process.env.CRON_SECRET ?? '').trim()
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
    rateLimitKey('sync-creator-metrics', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const forceFull = readBooleanQuery(req, 'forceFull')
  const pageSize = readNumberQuery(req, 'pageSize')
  const maxPages = readNumberQuery(req, 'maxPages')
  const mode = readSyncMode(req)

  if (mode === 'hot') {
    const result = await runCreatorMetricsHotSync()
    const status = result.ok ? 200 : 500
    return res.status(status).json({
      success: result.ok,
      data: result,
    })
  }

  if (mode === 'explore') {
    const exploreMaxPages = readNumberQuery(req, 'maxPages')
    const result = await runCreatorMetricsExploreBackfill({
      forceFull,
      maxPagesPerList: exploreMaxPages,
      pageSize,
    })
    const status = result.ok ? 200 : 500
    return res.status(status).json({
      success: result.ok,
      data: result,
    })
  }

  const result = await runCreatorMetricsSync({
    forceFull,
    pageSize,
    maxPages,
    includeHotRefresh: false,
  })
  const status = result.ok ? 200 : 500
  return res.status(status).json({
    success: result.ok,
    data: result,
  })
}
