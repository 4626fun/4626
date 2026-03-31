import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'



import { validateQuoteTokenPolicy, validateRoutePolicy } from '../../../server/uniswap/guards.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'
import { validateSwapTransactionPayload } from '../../../server/uniswap/swapPayloadValidation.js'

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
    rateLimitKey('uniswap-swap', principalAddress.toLowerCase(), clientIp),
    RATE_LIMITS.general,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (!isObject(body.quote)) return res.status(400).json({ success: false, error: 'Missing required field: quote' })
  const quoteObj = body.quote as Record<string, unknown>
  const routingCandidate =
    body.routing ??
    quoteObj.routing ??
    quoteObj.routeType ??
    quoteObj.route ??
    quoteObj.type ??
    quoteObj.routingPreference
  const tokenPolicyErr = validateQuoteTokenPolicy(quoteObj)
  if (tokenPolicyErr) {
    return res.status(400).json({ success: false, error: tokenPolicyErr })
  }
  const routingPolicyErr = validateRoutePolicy(routingCandidate)
  if (routingPolicyErr) {
    return res.status(400).json({ success: false, error: routingPolicyErr })
  }

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

  const txValidationError = validateSwapTransactionPayload(upstream.payload)
  if (txValidationError) {
    return res.status(502).json({ success: false, error: txValidationError })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
