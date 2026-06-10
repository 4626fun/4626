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


import {
  validateAddressField,
  validateChainIdField,
  validateIntegerAmountField,
  validateTokenPolicy,
} from '../../../server/uniswap/guards.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

const ACTION_PATH: Record<string, string> = Object.freeze({
  positions: '/liquidity/positions',
  'quote-create': '/liquidity/quote',
  create: '/liquidity/create',
  add: '/liquidity/add',
  remove: '/liquidity/remove',
  claim: '/liquidity/claim',
  migrate: '/liquidity/migrate',
})

function assertPayloadSafety(payload: Record<string, unknown>): string | null {
  const chainErr = validateChainIdField(payload, 'chainId')
  if (chainErr) return chainErr

  for (const key of ['walletAddress', 'token0', 'token1', 'tokenIn', 'tokenOut']) {
    const err = validateAddressField(payload, key)
    if (err) return err
  }
  const tokenPolicyErr = validateTokenPolicy(payload, ['token0', 'token1', 'tokenIn', 'tokenOut'])
  if (tokenPolicyErr) return tokenPolicyErr

  for (const key of Object.keys(payload)) {
    if (!/^amount/i.test(key)) continue
    const err = validateIntegerAmountField(payload, key)
    if (err) return err
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

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(
    rateLimitKey('uniswap-liquidity', principalAddress, clientIp),
    RATE_LIMITS.general,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  const payload = isObject(body.payload) ? body.payload : null
  const path = Object.prototype.hasOwnProperty.call(ACTION_PATH, action) ? ACTION_PATH[action] : null
  if (!path || !payload) {
    return res.status(400).json({ success: false, error: 'Invalid liquidity action payload' })
  }

  const safetyError = assertPayloadSafety(payload)
  if (safetyError) return res.status(400).json({ success: false, error: safetyError })

  const upstream = await uniswapTradeFetch({
    path,
    method: 'POST',
    body: payload,
    timeoutMs: 15_000,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, `Liquidity action failed: ${action}`),
    })
  }

  if (!isObject(upstream.payload) && !Array.isArray(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid liquidity response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}
