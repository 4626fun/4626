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


import { getAllowedUniswapChainIds } from '../../../server/uniswap/guards.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

function isChainIdArray(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const allowed = getAllowedUniswapChainIds()
  return value.every((x) => {
    const chainId = Number(x)
    return Number.isInteger(chainId) && allowed.has(chainId)
  })
}

function isAddressArray(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((x) => typeof x === 'string' && /^0x[a-fA-F0-9]{40}$/.test(x.trim()))
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
    rateLimitKey('uniswap-check-delegation', principalAddress, clientIp),
    RATE_LIMITS.general,
    { failClosed: true },
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })

  if (!('chainIds' in body) || !isChainIdArray(body.chainIds)) {
    return res.status(400).json({ success: false, error: 'Unsupported chainIds' })
  }
  if ('walletAddresses' in body && body.walletAddresses !== undefined && !isAddressArray(body.walletAddresses)) {
    return res.status(400).json({ success: false, error: 'Invalid walletAddresses: expected address array' })
  }

  const upstream = await uniswapTradeFetch({
    path: '/wallet/check_delegation',
    method: 'POST',
    body,
  })

  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to check Uniswap wallet delegation'),
      details: upstream.payload,
    })
  }

  if (!isObject(upstream.payload)) {
    return res.status(502).json({ success: false, error: 'Invalid check_delegation response from Uniswap API' })
  }

  return res.status(200).json({ success: true, data: upstream.payload })
}

