import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  guardAgentApiRequest,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { normalizeChatAddress, recordPresenceHeartbeat } from '../../../../server/_lib/chat/presence.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/chat/presence/heartbeat', kind: 'write' })
  if (!g.ok) return

  const address = normalizeChatAddress(g.auth?.address)
  if (!address) return res.status(401).json({ success: false, error: 'Authentication required' })

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-presence-heartbeat', address, getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 2048 })) ?? {}
  const status = typeof body.status === 'string' ? body.status : 'available'

  await recordPresenceHeartbeat({
    address,
    status,
    ip: getClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  })

  return res.status(200).json({
    success: true,
    data: {
      visible: true,
      availableUntilSeconds: 120,
    },
  })
}
