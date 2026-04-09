import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { trackChatCommandCenterEvent } from '../../../../server/_lib/chatCommandCenterTelemetry.js'

type TelemetryBody = {
  event?: string
  conversationId?: string | null
  conversationType?: string | null
  commandId?: string | null
  source?: string | null
  [key: string]: unknown
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-telemetry', getClientIp(req)),
    RATE_LIMITS.chatTelemetry,
  )
  if (!limiter.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody(req, { maxBytes: 65_536 })
  const event = typeof body?.event === 'string' ? body.event.trim() : ''
  if (!event) {
    return res.status(400).json({ success: false, error: 'Missing event' } satisfies ApiEnvelope<never>)
  }

  const {
    event: _event,
    conversationId,
    conversationType,
    commandId,
    source,
    ...payloadRest
  } = body ?? {}

  void trackChatCommandCenterEvent({
    event,
    conversationId: typeof conversationId === 'string' ? conversationId : null,
    conversationType: typeof conversationType === 'string' ? conversationType : null,
    commandId: typeof commandId === 'string' ? commandId : null,
    source: typeof source === 'string' ? source : null,
    payload: payloadRest,
  })

  return res.status(200).json({
    success: true,
    data: { accepted: true },
  } satisfies ApiEnvelope<{ accepted: true }>)
}
