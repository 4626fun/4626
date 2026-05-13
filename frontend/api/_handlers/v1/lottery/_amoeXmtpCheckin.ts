import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'
import { claimDailyXmtpCheckin } from '../../../../server/_lib/lottery/lotteryAmoe.js'

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

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/xmtp-checkin', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-xmtp-checkin', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const wallet = g.auth?.address
  if (!wallet) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const resolvedWallet = await resolveAmoeWallet({
    authAddress: wallet,
  })
  if (!resolvedWallet.ok) {
    const status = resolvedWallet.error === 'wallet_authority_mismatch' ? 403 : 400
    return res.status(status).json({
      success: false,
      error: resolvedWallet.error,
    })
  }
  const effectiveWallet = resolvedWallet.value.wallet

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'xmtp-checkin', ip, effectiveWallet), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const result = await claimDailyXmtpCheckin({ wallet: effectiveWallet })
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'amoe_xmtp_checkin_failed'
    return res.status(500).json({ success: false, error: message })
  }
}

