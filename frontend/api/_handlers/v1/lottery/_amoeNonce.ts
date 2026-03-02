import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
import { checkDurableRateLimit } from '../../../server/_lib/durableRateLimit.js'
import { getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { buildAmoeEntryMessage, getAmoeCreditSnapshot, issueAmoeNonce } from '../../../server/_lib/lotteryAmoe.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/nonce', kind: 'read' })
  if (!g.ok) return

  const walletRaw = typeof req.query.wallet === 'string' ? req.query.wallet.trim() : ''
  const creatorCoinRaw = typeof req.query.creatorCoin === 'string' ? req.query.creatorCoin.trim() : ''
  if (!isAddressLike(walletRaw) || !isAddressLike(creatorCoinRaw)) {
    return res.status(400).json({ success: false, error: 'Missing or invalid wallet/creatorCoin' })
  }

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!isAddressLike(String(lotteryManager ?? ''))) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'nonce', ip, walletRaw.toLowerCase()), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  const noncePayload = await issueAmoeNonce({
    wallet: walletRaw.toLowerCase() as `0x${string}`,
    creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
  })
  const creditSnapshot = await getAmoeCreditSnapshot({
    wallet: walletRaw.toLowerCase() as `0x${string}`,
  })

  const message = buildAmoeEntryMessage({
    wallet: walletRaw.toLowerCase() as `0x${string}`,
    creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
    nonce: noncePayload.nonce,
    issuedAt: noncePayload.issuedAt,
    expiresAt: noncePayload.expiresAt,
    chainId: 8453,
    lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
  })

  return res.status(200).json({
    success: true,
    data: {
      wallet: walletRaw.toLowerCase(),
      creatorCoin: creatorCoinRaw.toLowerCase(),
      nonce: noncePayload.nonce,
      issuedAt: noncePayload.issuedAt,
      expiresAt: noncePayload.expiresAt,
      chainId: 8453,
      lotteryManager: String(lotteryManager).toLowerCase(),
      message,
      credits: creditSnapshot.credits,
      creditsPerEntry: creditSnapshot.creditsPerEntry,
      entriesAvailable: creditSnapshot.entriesAvailable,
      nextEntryAtCredits: creditSnapshot.nextEntryAtCredits,
    },
  })
}
