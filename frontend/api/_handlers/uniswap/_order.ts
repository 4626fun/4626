import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

function isErc20EthEnabledHeader(req: VercelRequest): boolean {
  const raw = req.headers['x-erc20eth-enabled']
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return false
  const lc = v.trim().toLowerCase()
  return lc === 'true' || lc === '1'
}

export function validateOrderResponsePayload(payload: unknown): string | null {
  if (!isObject(payload)) return 'Invalid order response from Uniswap API'
  if (typeof payload.requestId !== 'string' || !payload.requestId.trim()) {
    return 'Uniswap order response missing requestId'
  }
  if (typeof payload.orderId !== 'string' || !payload.orderId.trim()) {
    return 'Uniswap order response missing orderId'
  }
  if (typeof payload.orderStatus !== 'string' || !payload.orderStatus.trim()) {
    return 'Uniswap order response missing orderStatus'
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('uniswap-order', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (typeof body.signature !== 'string' || !body.signature.trim()) {
    return res.status(400).json({ success: false, error: 'Missing required field: signature' })
  }
  if (!isObject(body.quote)) {
    return res.status(400).json({ success: false, error: 'Missing required field: quote' })
  }

  const headers = isErc20EthEnabledHeader(req) ? { 'x-erc20eth-enabled': 'true' } : undefined
  const upstream = await uniswapTradeFetch({
    path: '/order',
    method: 'POST',
    body,
    headers,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to submit UniswapX order'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid order response from Uniswap API' })
  }

  const validationError = validateOrderResponsePayload(upstream.payload)
  if (validationError) {
    return res.status(502).json({ success: false, error: validationError })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}

