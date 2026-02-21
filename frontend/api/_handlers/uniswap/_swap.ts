import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { isObject, readJsonObjectBody, toCleanErrorMessage, uniswapTradeFetch } from '../../../server/uniswap/trading.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_RE = /^0x[0-9a-fA-F]+$/
const DECIMAL_RE = /^\d+$/

function isNumericString(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false
  const raw = value.trim()
  return HEX_RE.test(raw) || DECIMAL_RE.test(raw)
}

export function validateSwapTransactionPayload(payload: unknown): string | null {
  if (!isObject(payload)) return 'Invalid swap response from Uniswap API'

  const tx = payload.swap
  if (!isObject(tx)) return 'Uniswap swap response missing transaction payload'

  const to = tx.to
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) {
    return 'Uniswap swap response contains invalid recipient address'
  }
  const from = tx.from
  if (typeof from !== 'string' || !ADDRESS_RE.test(from)) {
    return 'Uniswap swap response contains invalid sender address'
  }

  const data = tx.data
  if (typeof data !== 'string' || data === '' || data === '0x' || !HEX_RE.test(data)) {
    return 'Uniswap swap response contains invalid transaction data'
  }

  if ('value' in tx && tx.value != null && !isNumericString(tx.value)) {
    return 'Uniswap swap response contains invalid transaction value'
  }
  if ('gasLimit' in tx && tx.gasLimit != null && !isNumericString(tx.gasLimit)) {
    return 'Uniswap swap response contains invalid gas limit'
  }
  if ('maxFeePerGas' in tx && tx.maxFeePerGas != null && !isNumericString(tx.maxFeePerGas)) {
    return 'Uniswap swap response contains invalid maxFeePerGas'
  }
  if ('maxPriorityFeePerGas' in tx && tx.maxPriorityFeePerGas != null && !isNumericString(tx.maxPriorityFeePerGas)) {
    return 'Uniswap swap response contains invalid maxPriorityFeePerGas'
  }
  if ('gasPrice' in tx && tx.gasPrice != null && !isNumericString(tx.gasPrice)) {
    return 'Uniswap swap response contains invalid gasPrice'
  }
  if (tx.maxFeePerGas != null && tx.gasPrice != null) {
    return 'Uniswap swap response contains conflicting gas fields'
  }

  if ('chainId' in tx && tx.chainId != null) {
    const chainId = Number(tx.chainId)
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return 'Uniswap swap response contains invalid chainId'
    }
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
  const rate = checkRateLimit(rateLimitKey('uniswap-swap', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = await readJsonObjectBody(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  if (!isObject(body.quote)) return res.status(400).json({ success: false, error: 'Missing required field: quote' })

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
