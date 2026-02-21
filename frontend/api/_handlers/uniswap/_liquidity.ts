import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

const ACTION_PATH: Record<string, string> = {
  positions: '/liquidity/positions',
  'quote-create': '/liquidity/quote',
  create: '/liquidity/create',
  add: '/liquidity/add',
  remove: '/liquidity/remove',
  claim: '/liquidity/claim',
  migrate: '/liquidity/migrate',
}

const ALLOWED_CHAIN_IDS = new Set([8453])
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && ADDRESS_RE.test(value.trim())
}

function assertPayloadSafety(payload: Record<string, unknown>): string | null {
  const chainIdRaw = payload.chainId
  if (chainIdRaw !== undefined) {
    const chainId = Number(chainIdRaw)
    if (!Number.isInteger(chainId) || !ALLOWED_CHAIN_IDS.has(chainId)) return 'Unsupported chainId'
  }

  for (const key of ['walletAddress', 'token0', 'token1', 'tokenIn', 'tokenOut']) {
    const value = payload[key]
    if (value === undefined || value === null || value === '') continue
    if (!isAddress(value)) return `Invalid address field: ${key}`
  }

  for (const [k, v] of Object.entries(payload)) {
    if (!/^amount/i.test(k)) continue
    if (typeof v !== 'string' && typeof v !== 'number') return `Invalid amount field: ${k}`
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || n <= 0 || n > 1e15) return `Amount out of bounds: ${k}`
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

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('uniswap-liquidity', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })

  const action = typeof body.action === 'string' ? body.action : ''
  const payload = isObject(body.payload) ? body.payload : null
  const path = ACTION_PATH[action]
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
