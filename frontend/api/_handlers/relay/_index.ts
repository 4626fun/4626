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

const RELAY_INDEX_BODY_MAX_BYTES = 16 * 1024
const RELAY_INDEX_URL = 'https://api.relay.link/transactions/index'

type RelayIndexRequest = {
  txHash?: unknown
  chainId?: unknown
  requestId?: unknown
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
    rateLimitKey('relay:index', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: RelayIndexRequest
  try {
    body = (await readJsonBody(req, { maxBytes: RELAY_INDEX_BODY_MAX_BYTES })) as RelayIndexRequest
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : ''
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return res.status(400).json({ success: false, error: 'txHash must be a 32-byte hex hash' } satisfies ApiEnvelope<never>)
  }
  const chainIdRaw =
    typeof body.chainId === 'number'
      ? String(Math.trunc(body.chainId))
      : typeof body.chainId === 'string'
        ? body.chainId.trim()
        : ''
  if (chainIdRaw !== '8453') {
    return res.status(400).json({ success: false, error: 'chainId must be 8453 (Base mainnet)' } satisfies ApiEnvelope<never>)
  }
  const requestId =
    typeof body.requestId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.requestId.trim())
      ? body.requestId.trim()
      : null

  const apiKey = resolveRelayApiKey()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(RELAY_INDEX_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        txHash,
        chainId: chainIdRaw,
        ...(requestId ? { requestId } : {}),
      }),
    })
  } catch (error) {
    logger.warn('[relay/index] upstream fetch failed', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
    return res.status(502).json({ success: false, error: 'Failed to reach Relay /transactions/index' } satisfies ApiEnvelope<never>)
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
    const message =
      upstreamBody && typeof upstreamBody === 'object'
        ? String((upstreamBody as Record<string, unknown>).message ?? (upstreamBody as Record<string, unknown>).error ?? '')
        : String(upstreamBody ?? '')
    logger.warn('[relay/index] upstream rejected', { status: upstreamRes.status, message })
    return res.status(upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502).json({
      success: false,
      error: message
        ? `Relay /transactions/index (${upstreamRes.status}): ${message}`
        : `Relay /transactions/index failed with status ${upstreamRes.status}`,
      status: upstreamRes.status,
      data: upstreamBody,
    })
  }

  return res.status(200).json({ success: true, data: upstreamBody } satisfies ApiEnvelope<unknown>)
}
