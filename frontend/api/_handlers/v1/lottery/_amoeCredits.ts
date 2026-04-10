import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { resolveAmoeWallet } from '../../../../server/_lib/amoeWalletResolver.js'
import { getAmoeCreditSnapshot } from '../../../../server/_lib/lotteryAmoe.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/credits', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-credits', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const walletRaw = typeof req.query.wallet === 'string' ? req.query.wallet.trim() : ''
  if (!isAddressLike(walletRaw)) {
    return res.status(400).json({ success: false, error: 'Missing or invalid wallet' })
  }

  const resolvedWallet = await resolveAmoeWallet({
    requestedWallet: walletRaw,
    authAddress: g.auth?.address ?? null,
  })
  if (!resolvedWallet.ok) {
    const status = resolvedWallet.error === 'wallet_authority_mismatch' ? 403 : 400
    return res.status(status).json({
      success: false,
      error: resolvedWallet.error,
    })
  }

  try {
    const snapshot = await getAmoeCreditSnapshot({ wallet: resolvedWallet.value.wallet })
    return res.status(200).json({ success: true, data: snapshot })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'amoe_credit_snapshot_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
