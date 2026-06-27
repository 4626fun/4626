import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
  readRequestPrincipalAddress,
} from '@4626/server-core'



import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'
import {
  validateAddressField,
  validateChainIdField,
  validateIntegerAmountField,
  validateRoutePolicy,
  validateTokenPolicy,
} from '../../../server/uniswap/guards.js'

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

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = await checkDurableRateLimit(
    rateLimitKey('uniswap-quote', principalAddress.toLowerCase(), clientIp),
    RATE_LIMITS.general,
    { failClosed: true },
  )
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


  for (const field of ['tokenInChainId', 'tokenOutChainId']) {
    const err = validateChainIdField(body, field)
    if (err) return res.status(400).json({ success: false, error: err })
  }
  for (const field of ['tokenIn', 'tokenOut', 'swapper']) {
    const err = validateAddressField(body, field)
    if (err) return res.status(400).json({ success: false, error: err })
  }
  const tokenPolicyErr = validateTokenPolicy(body, ['tokenIn', 'tokenOut'])
  if (tokenPolicyErr) {
    console.warn('[uniswap][policy] quote blocked', { reason: tokenPolicyErr, type: 'token' })
    return res.status(400).json({ success: false, error: tokenPolicyErr })
  }
  const amountErr = validateIntegerAmountField(body, 'amount')
  if (amountErr) return res.status(400).json({ success: false, error: amountErr })

  const tokenInChainId = Number(body.tokenInChainId)
  const tokenOutChainId = Number(body.tokenOutChainId)
  const crossChain = Number.isFinite(tokenInChainId) && Number.isFinite(tokenOutChainId) && tokenInChainId !== tokenOutChainId

  const chainedActionsEnabled = body.xChainedActionsEnabled === true || body.chainedActionsEnabled === true || crossChain

  const payload: Record<string, unknown> = { ...body }
  delete payload.xChainedActionsEnabled
  delete payload.chainedActionsEnabled

  const headers: Record<string, string> = {}
  if (chainedActionsEnabled) headers['x-chained-actions-enabled'] = 'true'
  if (isErc20EthEnabledHeader(req)) headers['x-erc20eth-enabled'] = 'true'

  const upstream = await uniswapTradeFetch({
    path: '/quote',
    method: 'POST',
    body: payload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
  const routingErr = validateRoutePolicy((upstream.payload as Record<string, unknown>).routing)
  if (routingErr) {
    console.warn('[uniswap][policy] quote blocked', { reason: routingErr, type: 'routing' })
    return res.status(422).json({ success: false, error: routingErr })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
