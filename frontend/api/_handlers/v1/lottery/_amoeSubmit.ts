import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
import { checkDurableRateLimit } from '../../../server/_lib/durableRateLimit.js'
import { getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import {
  AMOE_CREDITS_PER_ENTRY,
  consumeAmoeCreditsForEntry,
  createAmoeAttestation,
  verifyAmoeEntryProof,
} from '../../../server/_lib/lotteryAmoe.js'

type SubmitBody = {
  creatorCoin?: string
  message?: string
  signature?: string
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/submit', kind: 'read' })
  if (!g.ok) return

  const body = (await readJsonBody<SubmitBody>(req)) ?? {}
  const creatorCoinRaw = typeof body.creatorCoin === 'string' ? body.creatorCoin.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const signatureRaw = typeof body.signature === 'string' ? body.signature.trim() : ''

  if (!isAddressLike(creatorCoinRaw) || !message || !signatureRaw.startsWith('0x')) {
    return res.status(400).json({ success: false, error: 'Missing or invalid creatorCoin/message/signature' })
  }

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!isAddressLike(String(lotteryManager ?? ''))) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'submit', ip, creatorCoinRaw.toLowerCase()), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const proof = await verifyAmoeEntryProof({
      creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
      message,
      signature: signatureRaw as `0x${string}`,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    const creditSpend = await consumeAmoeCreditsForEntry({
      wallet: proof.wallet,
      requiredCredits: AMOE_CREDITS_PER_ENTRY,
      refId: `${proof.creatorCoin}:${proof.nonce}`,
    })

    const attested = await createAmoeAttestation({
      wallet: proof.wallet,
      creatorCoin: proof.creatorCoin,
      nonce: proof.nonce,
      expiresAt: proof.expiresAt,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    return res.status(200).json({
      success: true,
      data: {
        ...attested,
        creditsConsumed: creditSpend.consumed,
        creditsRemaining: creditSpend.creditsRemaining,
        creditsPerEntry: creditSpend.creditsPerEntry,
        entriesAvailable: creditSpend.entriesAvailable,
      },
    })
  } catch (error: unknown) {
    const messageText = error instanceof Error ? error.message : 'amoe_submit_failed'
    const status = messageText.includes('insufficient')
      ? 402
      : messageText.includes('invalid') || messageText.includes('mismatch') || messageText.includes('expired')
        ? 400
        : 500
    return res.status(status).json({
      success: false,
      error: messageText,
    })
  }
}
