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
  validateTokenPolicy,
} from '../../../server/uniswap/guards.js'

function isPermit2Disabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  const lc = value.trim().toLowerCase()
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
  const rate = await checkDurableRateLimit(
    rateLimitKey('uniswap-check-approval', principalAddress, clientIp),
    RATE_LIMITS.general,
    { failClosed: true },
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })

  const required = ['walletAddress', 'token', 'amount', 'chainId'] as const
  for (const key of required) {
    if (!(key in body)) return res.status(400).json({ success: false, error: `Missing required field: ${key}` })
  }


  const chainErr = validateChainIdField(body, 'chainId')
  if (chainErr) return res.status(400).json({ success: false, error: chainErr })
  for (const field of ['walletAddress', 'token']) {
    const err = validateAddressField(body, field)
    if (err) return res.status(400).json({ success: false, error: err })
  }
  const tokenPolicyErr = validateTokenPolicy(body, ['token'])
  if (tokenPolicyErr) return res.status(400).json({ success: false, error: tokenPolicyErr })
  const amountErr = validateIntegerAmountField(body, 'amount')
  if (amountErr) return res.status(400).json({ success: false, error: amountErr })

  const payload: Record<string, unknown> = { ...body }
  delete payload.permit2Disabled
  const headers: Record<string, string> = {}
  if (isPermit2Disabled(body.permit2Disabled) || isPermit2Disabled(req.headers['x-permit2-disabled'])) {
    headers['x-permit2-disabled'] = 'true'
  }

  const upstream = await uniswapTradeFetch({
    path: '/check_approval',
    method: 'POST',
    body: payload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to check Uniswap approval'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid check_approval response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
