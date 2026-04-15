import type { VercelRequest, VercelResponse } from '@vercel/node'

import { readSessionFromRequest } from '../../auth/_shared.js'
import { readSiwaAgentFromRequest } from '../../auth/_siwa.js'
import { getClientIp, rateLimitKey } from '../rateLimit.js'
import { checkDurableRateLimit, type DurableRateLimitResult } from '../durableRateLimit.js'
import { logAgentApiRequest } from './agentAudit.js'

export const AGENT_RATE_LIMITS = {
  read: { windowMs: 60_000, maxRequests: 120 },
  logs: { windowMs: 60_000, maxRequests: 30 },
  build: { windowMs: 60_000, maxRequests: 60 },
  write: { windowMs: 60_000, maxRequests: 30 },
} as const

export type AgentApiAuthContext =
  | { type: 'session'; address: string }
  | { type: 'siwa'; address: string; agentId: number; agentRegistry: string; chainId: number }

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
}): Promise<{ ok: true; ip: string; auth: AgentApiAuthContext | null } | { ok: false; ip: string }> {
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

  const session = readSessionFromRequest(params.req)
  const siwaAgent = readSiwaAgentFromRequest(params.req)

  const auth: AgentApiAuthContext | null = session?.address
    ? { type: 'session', address: String(session.address).toLowerCase() }
    : siwaAgent
      ? {
          type: 'siwa',
          address: String(siwaAgent.address).toLowerCase(),
          agentId: Number(siwaAgent.agentId),
          agentRegistry: String(siwaAgent.agentRegistry).toLowerCase(),
          chainId: Number(siwaAgent.chainId),
        }
      : null

  const requiresAuth = params.kind === 'build' || params.kind === 'write'
  if (requiresAuth && !auth) {
    params.res.status(401).json({
      success: false,
      error: 'Authentication required (session or SIWA receipt)',
    })
    return { ok: false, ip }
  }

  return { ok: true, ip, auth }
}

