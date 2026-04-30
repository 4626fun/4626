import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  guardAgentApiRequest,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { getCachedEthosScoreByAddress } from '../../../../server/_lib/chat/ethosClient.js'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/chat/search', kind: 'read' })
  if (!g.ok) return

  const requester = normalizeChatAddress(g.auth?.address)
  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-search', requester ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const address = normalizeChatAddress(query)
  if (!address) {
    return res.status(200).json({ success: true, data: { users: [], agents: [], vaults: [] } })
  }

  let ethos = null
  try {
    ethos = await getCachedEthosScoreByAddress(address)
  } catch {
    ethos = null
  }

  return res.status(200).json({
    success: true,
    data: {
      users: [{
        address,
        ethosScore: ethos?.score ?? null,
        ethosLevel: ethos?.level ?? null,
      }],
      agents: [],
      vaults: [],
    },
  })
}
