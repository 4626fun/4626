import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getApiContracts,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { resolveAmoeCreatorTarget } from '../../../../server/_lib/lottery/amoeCreatorTarget.js'

import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  buildAmoeEntryMessage,
  getAmoeCreditSnapshot,
  issueAmoeNonce,
} from '../../../../server/_lib/lottery/lotteryAmoe.js'

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

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-nonce', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const walletRaw = typeof req.query.wallet === 'string' ? req.query.wallet.trim() : ''
  const creatorCoinRaw = typeof req.query.creatorCoin === 'string' ? req.query.creatorCoin.trim() : ''
  if (walletRaw && !isAddressLike(walletRaw)) {
    return res.status(400).json({ success: false, error: 'Missing or invalid wallet' })
  }
  const creatorTarget = resolveAmoeCreatorTarget(creatorCoinRaw)
  if (!creatorTarget.ok) {
    const status = creatorTarget.error === 'invalid_creator_coin' ? 400 : 503
    return res.status(status).json({
      success: false,
      error: creatorTarget.error === 'invalid_creator_coin' ? 'invalid_creatorCoin' : creatorTarget.error,
    })
  }
  const creatorCoin = creatorTarget.creatorCoin

  const resolvedWallet = await resolveAmoeWallet({
    requestedWallet: walletRaw || null,
    authAddress: g.auth?.address ?? null,
  })
  if (!resolvedWallet.ok) {
    const status = resolvedWallet.error === 'wallet_authority_mismatch' ? 403 : 400
    return res.status(status).json({
      success: false,
      error: resolvedWallet.error,
    })
  }
  const wallet = resolvedWallet.value.wallet

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!isAddressLike(String(lotteryManager ?? ''))) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'nonce', ip, wallet), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  const noncePayload = await issueAmoeNonce({
    wallet,
    creatorCoin,
  })
  const creditSnapshot = await getAmoeCreditSnapshot({
    wallet,
  })

  const message = buildAmoeEntryMessage({
    wallet,
    creatorCoin,
    nonce: noncePayload.nonce,
    issuedAt: noncePayload.issuedAt,
    expiresAt: noncePayload.expiresAt,
    chainId: 8453,
    lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
  })

  return res.status(200).json({
    success: true,
    data: {
      wallet,
      creatorCoin,
      creatorCoinSource: creatorTarget.source,
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
