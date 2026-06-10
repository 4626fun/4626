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
} from '@4626/server-core'



import { validateQuoteTokenPolicy, validateRoutePolicy } from '../../../server/uniswap/guards.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'
import { sanitizeCreateSwapRequestPayload } from '../../../src/lib/uniswap/swapQuoteSanitize.js'
import {
  normalizeSwapApiResponsePayload,
  validateSwapTransactionPayload,
} from '../../../server/uniswap/swapPayloadValidation.js'

function isPermit2Disabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  const lc = value.trim().toLowerCase()
  return lc === 'true' || lc === '1'
}

function stripPermit2Fields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPermit2Fields)
  if (!isObject(value)) return value

  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (
      key === 'permitData' ||
      key === 'permitSingleData' ||
      key === 'permitTransferFromData' ||
      key === 'signature'
    ) {
      continue
    }
    next[key] = stripPermit2Fields(item)
  }
  return next
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

  const permit2Disabled = isPermit2Disabled(body.permit2Disabled) || isPermit2Disabled(req.headers['x-permit2-disabled'])
  const effectiveBody = permit2Disabled ? (stripPermit2Fields(body) as Record<string, unknown>) : body
  const hasSignature = typeof effectiveBody.signature === 'string' && effectiveBody.signature.trim().length > 0
  const hasPermitData = isObject(effectiveBody.permitData)
  if (hasSignature !== hasPermitData) {
    return res.status(400).json({
      success: false,
      error: 'signature and permitData must either both be present or both be omitted',
    })
  }

  const payload = sanitizeCreateSwapRequestPayload(effectiveBody)
  const headers: Record<string, string> = {}
  if (permit2Disabled) {
    headers['x-permit2-disabled'] = 'true'
  }

  const upstream = await uniswapTradeFetch({
    path: '/swap',
    method: 'POST',
    body: payload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to build Uniswap swap transaction'),
      details: upstream.payload,
    })
  }

  const normalizedPayload = normalizeSwapApiResponsePayload(upstream.payload)
  const txValidationError = validateSwapTransactionPayload(normalizedPayload)
  if (txValidationError) {
    return res.status(502).json({ success: false, error: txValidationError })
  }

  return res.status(200).json({ success: true, data: normalizedPayload })
}
