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
  const rate = checkRateLimit(rateLimitKey('uniswap-quote', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  }

  const required = ['tokenIn', 'tokenOut', 'type', 'amount', 'swapper', 'tokenInChainId', 'tokenOutChainId'] as const
  for (const key of required) {
    if (!(key in body)) return res.status(400).json({ success: false, error: `Missing required field: ${key}` })
  }

  const tokenInChainId = Number(body.tokenInChainId)
  const tokenOutChainId = Number(body.tokenOutChainId)
  const crossChain = Number.isFinite(tokenInChainId) && Number.isFinite(tokenOutChainId) && tokenInChainId !== tokenOutChainId

  const chainedActionsEnabled = body.xChainedActionsEnabled === true || body.chainedActionsEnabled === true || crossChain

  const payload: Record<string, unknown> = { ...body }
  delete payload.xChainedActionsEnabled
  delete payload.chainedActionsEnabled

  const upstream = await uniswapTradeFetch({
    path: '/quote',
    method: 'POST',
    body: payload,
    headers: chainedActionsEnabled ? { 'x-chained-actions-enabled': 'true' } : undefined,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to fetch Uniswap quote'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid quote response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
