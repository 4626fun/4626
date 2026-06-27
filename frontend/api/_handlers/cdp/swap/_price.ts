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

import { cdpTradeFetch, normalizeCdpSwapPayload } from '../../../../server/cdp/trading.js'
import {
  validateCdpAddress,
  validateCdpAmount,
  validateCdpNetwork,
  validateCdpSlippageBps,
} from '../../../../server/cdp/guards.js'
import { readJsonObjectBody, toCleanErrorMessage } from '../../../../server/uniswap/trading.js'

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
    rateLimitKey('cdp-swap-price', principalAddress.toLowerCase(), clientIp),
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

  const required = ['network', 'fromToken', 'toToken', 'fromAmount'] as const
  for (const key of required) {
    if (!(key in body)) return res.status(400).json({ success: false, error: `Missing required field: ${key}` })
  }

  const networkErr = validateCdpNetwork(body.network)
  if (networkErr) return res.status(400).json({ success: false, error: networkErr })
  const fromTokenErr = validateCdpAddress(body.fromToken, 'fromToken')
  if (fromTokenErr) return res.status(400).json({ success: false, error: fromTokenErr })
  const toTokenErr = validateCdpAddress(body.toToken, 'toToken')
  if (toTokenErr) return res.status(400).json({ success: false, error: toTokenErr })
  const amountErr = validateCdpAmount(body.fromAmount, 'fromAmount')
  if (amountErr) return res.status(400).json({ success: false, error: amountErr })
  const takerErr = validateCdpAddress(body.taker, 'taker')
  if (takerErr) return res.status(400).json({ success: false, error: takerErr })
  const signerErr = validateCdpAddress(body.account, 'account')
  if (signerErr) return res.status(400).json({ success: false, error: signerErr })
  const slippageErr = validateCdpSlippageBps(body.slippageBps)
  if (slippageErr) return res.status(400).json({ success: false, error: slippageErr })

  const upstream = await cdpTradeFetch({
    path: '/platform/v2/evm/swaps/quote',
    method: 'POST',
    body: body as Record<string, unknown>,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to fetch CDP swap price'),
      details: upstream.payload,
    })
  }

  const normalized = normalizeCdpSwapPayload(upstream.payload)
  if (!normalized) {
    return res.status(502).json({ success: false, error: 'Invalid swap price response from CDP API' })
  }

  return res.status(200).json({ success: true, data: normalized })
}
