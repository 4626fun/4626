import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getClientIp, rateLimitKey } from './rateLimit.js'
import { checkDurableRateLimit, type DurableRateLimitResult } from './durableRateLimit.js'
import { logAgentApiRequest } from './agentAudit.js'

export const AGENT_RATE_LIMITS = {
  read: { windowMs: 60_000, maxRequests: 120 },
  logs: { windowMs: 60_000, maxRequests: 30 },
  build: { windowMs: 60_000, maxRequests: 60 },
} as const

function setRateLimitHeaders(res: VercelResponse, result: DurableRateLimitResult) {
  res.setHeader('X-RateLimit-Remaining', String(result.remaining))
  res.setHeader('X-RateLimit-Reset', String(result.resetAt))
  res.setHeader('X-RateLimit-Source', result.source)
}

export async function guardAgentApiRequest(params: {
  req: VercelRequest
  res: VercelResponse
  endpoint: string
  kind: keyof typeof AGENT_RATE_LIMITS
}): Promise<{ ok: true; ip: string } | { ok: false; ip: string }> {
  const ip = getClientIp(params.req as any)

  // Best-effort audit (DB-backed if configured).
  void logAgentApiRequest({
    endpoint: params.endpoint,
    method: params.req.method || 'UNKNOWN',
    ip,
    userAgent: typeof params.req.headers?.['user-agent'] === 'string' ? params.req.headers['user-agent'] : undefined,
  })

  const cfg = AGENT_RATE_LIMITS[params.kind]
  const key = rateLimitKey('agent', params.kind, params.endpoint, ip)
  const rl = await checkDurableRateLimit(key, cfg)
  setRateLimitHeaders(params.res, rl)

  if (!rl.allowed) {
    params.res.status(429).json({ success: false, error: 'Rate limited' })
    return { ok: false, ip }
  }

  return { ok: true, ip }
}

