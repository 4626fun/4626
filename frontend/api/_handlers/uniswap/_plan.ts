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


import { validateChainIdField, validateTokenPolicy } from '../../../server/uniswap/guards.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

function getPlanIdFromReq(req: VercelRequest, body: Record<string, unknown> | null): string {
  if (typeof req.query.planId === 'string' && req.query.planId.trim()) return req.query.planId.trim()
  if (body && typeof body.planId === 'string' && body.planId.trim()) return body.planId.trim()
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (!['POST', 'GET', 'PATCH'].includes(req.method || '')) {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const clientIp = getClientIp(req)
  const rate = await checkDurableRateLimit(rateLimitKey('uniswap-plan', principalAddress, clientIp), RATE_LIMITS.general, { failClosed: true })
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const method = req.method as 'POST' | 'GET' | 'PATCH'
  const body = method === 'GET' ? null : await readJsonObjectBody(req)
  if (method !== 'GET' && !body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })

  if (method === 'POST') {
    if (!body || !isObject(body.quote)) {
      return res.status(400).json({ success: false, error: 'Missing required field: quote' })
    }

    const quoteObj = body.quote as Record<string, unknown>
    for (const field of ['tokenInChainId', 'tokenOutChainId', 'chainId']) {
      const err = validateChainIdField(quoteObj, field)
      if (err) return res.status(400).json({ success: false, error: err })
    }
    const tokenPolicyErr = validateTokenPolicy(quoteObj, ['tokenIn', 'tokenOut'])
    if (tokenPolicyErr) return res.status(400).json({ success: false, error: tokenPolicyErr })

    const upstream = await uniswapTradeFetch({
      path: '/plan',
      method: 'POST',
      body,
    })
    if (upstream.status >= 400) {
      return res.status(upstream.status).json({
        success: false,
        error: toCleanErrorMessage(upstream.payload, 'Failed to create Uniswap cross-chain plan'),
      })
    }
    return res.status(200).json({ success: true, data: upstream.payload })
  }

  const planId = getPlanIdFromReq(req, body)
  if (!planId) return res.status(400).json({ success: false, error: 'Missing required field: planId' })

  if (method === 'GET') {
    const upstream = await uniswapTradeFetch({
      path: `/plan/${encodeURIComponent(planId)}`,
      method: 'GET',
    })
    if (upstream.status >= 400) {
      return res.status(upstream.status).json({
        success: false,
        error: toCleanErrorMessage(upstream.payload, 'Failed to fetch Uniswap cross-chain plan'),
      })
    }
    return res.status(200).json({ success: true, data: upstream.payload })
  }

  const patchBody: Record<string, unknown> = { ...(body ?? {}) }
  delete patchBody.planId
  const upstream = await uniswapTradeFetch({
    path: `/plan/${encodeURIComponent(planId)}`,
    method: 'PATCH',
    body: patchBody,
  })
  if (upstream.status >= 400) {
    return res.status(upstream.status).json({
      success: false,
      error: toCleanErrorMessage(upstream.payload, 'Failed to update Uniswap cross-chain plan'),
    })
  }
  return res.status(200).json({ success: true, data: upstream.payload })
}
