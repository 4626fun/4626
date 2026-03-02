import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'
import { checkDurableRateLimit } from '../../../server/_lib/durableRateLimit.js'
import { getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { claimDailyTwitterCheckin } from '../../../server/_lib/lotteryAmoe.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/twitter-checkin', kind: 'write' })
  if (!g.ok) return

  const wallet = g.auth?.address
  if (!wallet) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'twitter-checkin', ip, wallet.toLowerCase()), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const result = await claimDailyTwitterCheckin({ wallet: wallet.toLowerCase() as `0x${string}` })
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'amoe_twitter_checkin_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
