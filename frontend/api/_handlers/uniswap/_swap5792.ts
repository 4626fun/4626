import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('uniswap-swap-5792', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (typeof body.deadline !== 'number') {
    return res.status(400).json({ success: false, error: 'Missing required field: deadline' })
  }

  const hasQuote =
    isObject(body.classicQuote) ||
    isObject(body.wrapUnwrapQuote) ||
    isObject(body.bridgeQuote) ||
    isObject(body.priorityQuote)
  if (!hasQuote) {
    return res.status(400).json({
      success: false,
      error: 'Missing one of classicQuote, wrapUnwrapQuote, bridgeQuote, or priorityQuote',
    })
  }

  const upstream = await uniswapTradeFetch({
    path: '/swap_5792',
    method: 'POST',
    body,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to build Uniswap EIP-5792 calls'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid swap_5792 response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
