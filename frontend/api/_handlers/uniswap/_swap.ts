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
  const rate = checkRateLimit(rateLimitKey('uniswap-swap', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (!isObject(body.quote)) return res.status(400).json({ success: false, error: 'Missing required field: quote' })

  const hasSignature = typeof body.signature === 'string' && body.signature.trim().length > 0
  const hasPermitData = isObject(body.permitData)
  if (hasSignature !== hasPermitData) {
    return res.status(400).json({
      success: false,
      error: 'signature and permitData must either both be present or both be omitted',
    })
  }

  const upstream = await uniswapTradeFetch({
    path: '/swap',
    method: 'POST',
    body,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to build Uniswap swap transaction'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid swap response from Uniswap API' })
  }

  const tx = (upstream.payload as Record<string, unknown>).swap
  if (!isObject(tx) || typeof tx.data !== 'string' || tx.data === '' || tx.data === '0x') {
    return res.status(502).json({ success: false, error: 'Uniswap swap response contains empty transaction data' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
