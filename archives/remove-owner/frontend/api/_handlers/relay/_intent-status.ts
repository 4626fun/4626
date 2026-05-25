import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
  logger,
} from '../../../packages/server-core/src/index.js'
import { fetchRelayIntentStatus } from '../../../server/_lib/relay/fetchRelayIntentStatus.js'

function isRelayStatusId(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function readQueryParam(req: VercelRequest, key: string): unknown {
  const query = req.query?.[key]
  if (Array.isArray(query)) return query[0]
  return query
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('relay:intent-status', getClientIp(req)),
    RATE_LIMITS.relayIntentStatus,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const requestId = readQueryParam(req, 'requestId')
  const orderId = readQueryParam(req, 'orderId')
  const hasRequestId = isRelayStatusId(requestId)
  const hasOrderId = isRelayStatusId(orderId)

  if (hasRequestId === hasOrderId) {
    return res.status(400).json({
      success: false,
      error: 'Provide exactly one of requestId or orderId',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const data = await fetchRelayIntentStatus(
      hasRequestId ? { requestId } : { orderId: orderId as `0x${string}` },
    )
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<unknown>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? 'Relay status failed')
    logger.warn('[relay/intent-status] upstream failed', { message })
    return res.status(502).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
