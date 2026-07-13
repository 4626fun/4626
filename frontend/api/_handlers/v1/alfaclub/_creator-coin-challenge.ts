import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkDurableRateLimit,
  enforceCookieSessionTrustedOrigin,
  getClientIp,
  getSessionAddress,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  CreatorCoinLinkError,
  inspectCreatorCoinLink,
  issueCreatorCoinLinkChallenge,
} from '../../../../server/_lib/alfaclub/creatorCoinLink.js'

function sendError(res: VercelResponse, error: unknown) {
  if (error instanceof CreatorCoinLinkError) {
    return res.status(error.status).json({ success: false, error: error.code, message: error.message })
  }
  return res.status(500).json({ success: false, error: 'creator_coin_challenge_failed' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  if (enforceCookieSessionTrustedOrigin(req, res)) return

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'authentication_required' })
  }
  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1/alfaclub/creator-coin/challenge', sessionAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.cswLink,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'rate_limit_exceeded' })
  }

  try {
    const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) ?? {}
    const inspection = await inspectCreatorCoinLink({
      sessionAddress,
      roomId: typeof body.roomId === 'string' ? body.roomId : '',
      creatorCoinAddress:
        typeof body.creatorCoinAddress === 'string' ? body.creatorCoinAddress : '',
      executionAddress: typeof body.executionAddress === 'string' ? body.executionAddress : '',
    })
    const challenge = await issueCreatorCoinLinkChallenge({ sessionAddress, inspection })
    return res.status(200).json({ success: true, data: { inspection, challenge } })
  } catch (error) {
    return sendError(res, error)
  }
}
