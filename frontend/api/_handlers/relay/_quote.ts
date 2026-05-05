import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
  logger,
} from '../../../packages/server-core/src/index.js'

const RELAY_QUOTE_BODY_MAX_BYTES = 262_144
const RELAY_QUOTE_URL = 'https://api.relay.link/quote/v2'
const HANDLE_OPS_SELECTOR = '0x1fad948c'
const ENTRY_POINT_V06 = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'
const ENTRY_POINT_V07 = '0x0000000071727de22e5e9d8baf0edac6f37da032'
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'

type RelayQuoteRequest = {
  chainId?: unknown
  to?: unknown
  data?: unknown
  value?: unknown
  user?: unknown
}

function isAddressString(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isHexString(value: unknown, minBytes: number): value is string {
  return typeof value === 'string' && value.startsWith('0x') && value.length >= 2 + minBytes * 2
}

function resolveRelayApiKey(): string | null {
  const candidates = ['RELAY_API_KEY', 'VITE_RELAY_API_KEY', 'RELAY_LINK_API_KEY']
  for (const key of candidates) {
    const raw = (globalThis as any)?.process?.env?.[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('relay:quote', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: RelayQuoteRequest
  try {
    body = (await readJsonBody(req, { maxBytes: RELAY_QUOTE_BODY_MAX_BYTES })) as RelayQuoteRequest
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const chainId = typeof body.chainId === 'number' ? body.chainId : NaN
  if (chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'chainId must be 8453 (Base mainnet)' } satisfies ApiEnvelope<never>)
  }
  const toRaw = typeof body.to === 'string' ? body.to.toLowerCase() : ''
  if (!isAddressString(body.to) || (toRaw !== ENTRY_POINT_V06 && toRaw !== ENTRY_POINT_V07)) {
    return res.status(400).json({ success: false, error: 'to must be the EntryPoint v0.6 or v0.7 address' } satisfies ApiEnvelope<never>)
  }
  if (!isHexString(body.data, 4) || !body.data.toLowerCase().startsWith(HANDLE_OPS_SELECTOR)) {
    return res.status(400).json({
      success: false,
      error: `data must start with EntryPoint.handleOps selector (${HANDLE_OPS_SELECTOR})`,
    } satisfies ApiEnvelope<never>)
  }
  const valueRaw = typeof body.value === 'string' && body.value.trim() ? body.value.trim() : '0'
  if (valueRaw !== '0' && valueRaw !== '0x0') {
    return res.status(400).json({ success: false, error: 'value must be "0"' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressString(body.user)) {
    return res.status(400).json({ success: false, error: 'user must be the CSW address' } satisfies ApiEnvelope<never>)
  }

  const upstreamPayload = {
    user: body.user,
    recipient: body.user,
    originChainId: chainId,
    destinationChainId: chainId,
    originCurrency: NATIVE_CURRENCY,
    destinationCurrency: NATIVE_CURRENCY,
    amount: '0',
    tradeType: 'EXACT_OUTPUT',
    explicitDeposit: true,
    txs: [{ to: body.to, data: body.data, value: '0' }],
  }

  const apiKey = resolveRelayApiKey()
  let upstreamRes: Response
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey
    upstreamRes = await fetch(RELAY_QUOTE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(upstreamPayload),
    })
  } catch (error) {
    logger.warn('[relay/quote] upstream fetch failed', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
    return res.status(502).json({ success: false, error: 'Failed to reach Relay /quote/v2' } satisfies ApiEnvelope<never>)
  }

  const text = await upstreamRes.text().catch(() => '')
  let upstreamBody: unknown = null
  if (text) {
    try {
      upstreamBody = JSON.parse(text)
    } catch {
      upstreamBody = text
    }
  }
  if (!upstreamRes.ok) {
    const message = upstreamBody && typeof upstreamBody === 'object'
      ? String((upstreamBody as Record<string, unknown>).message ?? (upstreamBody as Record<string, unknown>).error ?? '')
      : String(upstreamBody ?? '')
    logger.warn('[relay/quote] upstream rejected', { status: upstreamRes.status, message })
    return res.status(upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502).json({
      success: false,
      error: message ? `Relay /quote/v2 (${upstreamRes.status}): ${message}` : `Relay /quote/v2 failed with status ${upstreamRes.status}`,
      status: upstreamRes.status,
      data: upstreamBody,
    })
  }

  return res.status(200).json({ success: true, data: upstreamBody } satisfies ApiEnvelope<unknown>)
}
