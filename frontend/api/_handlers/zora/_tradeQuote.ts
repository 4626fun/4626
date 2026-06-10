import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  RATE_LIMITS,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { fetchZoraTradeQuote } from '../../../server/_lib/zora/zoraTradeQuote.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSlippageFraction(body: Record<string, unknown>): number | undefined {
  if (!('slippage' in body)) return undefined
  const raw = body.slippage
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  // Accept either fraction (0.005) or percent (0.5) from clients.
  return n > 1 ? n / 100 : n
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(
    rateLimitKey('zora-trade-quote', principalAddress.toLowerCase(), clientIp),
    RATE_LIMITS.general,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = req.body
  if (!isObject(body)) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  }

  const tokenIn = String(body.tokenIn ?? '').trim()
  const tokenOut = String(body.tokenOut ?? '').trim()
  const amountIn = String(body.amountIn ?? '').trim()
  const sender = String(body.sender ?? '').trim()

  if (!tokenIn || !tokenOut || !amountIn || !sender) {
    return res.status(400).json({ success: false, error: 'tokenIn, tokenOut, amountIn, and sender are required' })
  }

  try {
    const quote = await fetchZoraTradeQuote({
      tokenIn,
      tokenOut,
      amountIn,
      sender,
      slippage: readSlippageFraction(body),
      signatures: Array.isArray(body.signatures) ? (body.signatures as any) : undefined,
    })
    return res.status(200).json({ success: true, data: quote })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Zora trade quote failed'
    return res.status(502).json({ success: false, error: message })
  }
}
