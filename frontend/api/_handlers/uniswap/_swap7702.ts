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

function isErc20EthEnabledHeader(req: VercelRequest): boolean {
  const raw = req.headers['x-erc20eth-enabled']
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return false
  const lc = v.trim().toLowerCase()
  return lc === 'true' || lc === '1'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(
    rateLimitKey('uniswap-swap-7702', principalAddress, clientIp),
    RATE_LIMITS.general,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (typeof body.smartContractDelegationAddress !== 'string' || !body.smartContractDelegationAddress.trim()) {
    return res.status(400).json({ success: false, error: 'Missing required field: smartContractDelegationAddress' })
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
  const quoteObj = (body.classicQuote ??
    body.wrapUnwrapQuote ??
    body.bridgeQuote ??
    body.priorityQuote) as Record<string, unknown>
  const tokenPolicyErr = validateQuoteTokenPolicy(quoteObj)
  if (tokenPolicyErr) {
    return res.status(400).json({ success: false, error: tokenPolicyErr })
  }
  const derivedRouting =
    quoteObj.routing ??
    (isObject(body.classicQuote)
      ? 'CLASSIC'
      : isObject(body.wrapUnwrapQuote)
        ? 'WRAP'
        : isObject(body.bridgeQuote)
          ? 'BRIDGE'
          : 'DUTCH_V3')
  const routingPolicyErr = validateRoutePolicy(derivedRouting)
  if (routingPolicyErr) {
    return res.status(400).json({ success: false, error: routingPolicyErr })
  }

  const headers = isErc20EthEnabledHeader(req) ? { 'x-erc20eth-enabled': 'true' } : undefined
  const upstream = await uniswapTradeFetch({
    path: '/swap_7702',
    method: 'POST',
    body,
    headers,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to build Uniswap EIP-7702 swap transaction'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid swap_7702 response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
