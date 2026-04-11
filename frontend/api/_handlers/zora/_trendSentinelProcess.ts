import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors } from '../../../server/zora/_shared.js'
import { readBoundedJsonObjectBody } from '../../../packages/server-core/src/index.js'
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { runTrendLaunchSentinelProcess } from '../../../server/zora/trendLaunchSentinel.js'

declare const process: { env: Record<string, string | undefined> }

type Body = {
  tickers?: string[] | string
  creatorToken?: string
  groupId?: string
  pollMs?: number | string
  jitterMs?: number | string
  maxRuntimeMs?: number | string
  maxConsecutiveErrors?: number | string
  requireReceipt?: boolean | string
}

function readBearerToken(req: VercelRequest): string {
  const header = String(req.headers.authorization ?? '').trim()
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice('bearer '.length).trim()
}

async function parseBody(req: VercelRequest): Promise<Body> {
  const TREND_SENTINEL_MAX_BODY_BYTES = 16_384
  try {
    return (await readBoundedJsonObjectBody(req, { maxBytes: TREND_SENTINEL_MAX_BODY_BYTES })) ?? {}
  } catch {
    throw new Error('body_too_large')
  }
}

function parseNumber(value: unknown): number | undefined {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n)) return undefined
  return Math.floor(n)
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return undefined
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return undefined
}

function parseTickers(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value === 'string' && value.trim()) return value.split(/[\s,]+/g).filter(Boolean)
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  res.setHeader('Cache-Control', 'no-store')
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('zora-trend-sentinel-process', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const secret = String(process.env.TREND_SENTINEL_SECRET ?? '').trim()
  const provided = readBearerToken(req)
  if (!secret || provided !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  let body: Body
  try {
    body = await parseBody(req)
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' })
  }
  try {
    const data = await runTrendLaunchSentinelProcess({
      overrides: {
        tickers: parseTickers(body.tickers),
        creatorToken: body.creatorToken,
        groupId: body.groupId,
        pollMs: parseNumber(body.pollMs),
        jitterMs: parseNumber(body.jitterMs),
        maxRuntimeMs: parseNumber(body.maxRuntimeMs),
        maxConsecutiveErrors: parseNumber(body.maxConsecutiveErrors),
        requireReceipt: parseBoolean(body.requireReceipt),
      },
    })
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: String(error?.message ?? 'trend_sentinel_process_failed').slice(0, 220),
    })
  }
}
