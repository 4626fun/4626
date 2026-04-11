import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  readRequestPrincipal,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

import { buildAgentPublishStatus, type AgentPublishData } from '../../../../server/_lib/erc8004OperatorStatus.js'


type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; missing?: string[] }

type Body = { storeOnGrove?: boolean }

type PublishResult = AgentPublishData & {
  registration: Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-agents-publish', getClientIp(req)),
    RATE_LIMITS.agentsWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req)
  if (!principal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const storeOnGrove = body.storeOnGrove !== false

  try {
    const result = await buildAgentPublishStatus({
      req,
      storeOnGrove,
      includeStoredGroveState: false,
    })

    return res.status(200).json({
      success: true,
      data: {
        registration: result.registration,
        ...result.publish,
        grove: result.publish.grove,
      } satisfies PublishResult,
    } satisfies ApiEnvelope<PublishResult>)
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    const missing = Array.isArray((error as { missing?: unknown })?.missing)
      ? ((error as { missing?: string[] }).missing ?? [])
      : undefined

    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish ERC-8004 registration.',
      ...(missing && missing.length > 0 ? { missing } : {}),
    } satisfies ApiEnvelope<never>)
  }
}
