import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  HERMIT_AVATAR_DEFAULT_SIGNATURE,
  HERMIT_AVATAR_SIZE_BOUNDS,
  renderHermitAvatarBuffer,
} from '../../../server/_lib/alfaclub/hermitAvatar.js'
import { getNumberQuery, getStringQuery, handleOptions, setPublicCors } from '../../../server/zora/_shared.js'
import { checkRateLimit, getClientIp, rateLimitKey } from '../../../packages/server-core/src/index.js'

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 60 } as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req as never) || 'unknown'
  const rate = checkRateLimit(rateLimitKey('token-hermit-avatar-ip', clientIp), RATE_LIMIT)
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT.maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rate.remaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rate.resetAt / 1000)))
  if (!rate.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  const requestedSize = getNumberQuery(req, 'size') ?? HERMIT_AVATAR_SIZE_BOUNDS.default
  const size = Math.min(
    HERMIT_AVATAR_SIZE_BOUNDS.max,
    Math.max(HERMIT_AVATAR_SIZE_BOUNDS.min, requestedSize),
  )
  const signatureRaw = (getStringQuery(req, 'signatureText') ?? '').trim()
  const signatureText = signatureRaw.length > 0 ? signatureRaw : HERMIT_AVATAR_DEFAULT_SIGNATURE

  try {
    const png = await renderHermitAvatarBuffer({ size, signatureText })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
    res.setHeader('Content-Length', String(png.byteLength))
    return res.status(200).send(png)
  } catch (err) {
    console.error('[token/hermit-avatar] render failed', err)
    return res.status(500).json({ error: 'Render failed' })
  }
}
