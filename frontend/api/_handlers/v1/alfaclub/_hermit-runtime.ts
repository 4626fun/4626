import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import { readHermitRuntimeStatusSnapshot } from '../../../../server/_lib/alfaclub/hermitRuntimeStatus.js'

function setPublicCors(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers.origin
  const requestOrigin =
    typeof originHeader === 'string' && originHeader.trim().length > 0 ? originHeader.trim() : null
  const allowOrigin =
    requestOrigin === 'https://app.4626.fun' ? 'https://app.4626.fun' : 'https://4626.fun'

  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(req, res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-hermit-runtime', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const limitRaw = Number(req.query.limit)
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined

  try {
    const snapshot = await readHermitRuntimeStatusSnapshot(limit)
    return res.status(200).json({ success: true, data: snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'runtime_status_unavailable'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
