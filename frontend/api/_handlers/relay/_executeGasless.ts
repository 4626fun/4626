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
} from '../../../packages/server-core/src/index.js'

const RELAY_EXECUTE_GASLESS_BODY_MAX_BYTES = 131_072
const RELAY_EXECUTE_GASLESS_URL = 'https://api.relay.link/execute'

type ExecuteGaslessRequest = {
  requestId?: unknown
  user?: unknown
  chainId?: unknown
  to?: unknown
  data?: unknown
  value?: unknown
}

function isAddressString(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)
}

function isHex32(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function hexOrDecimalToDecimalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^[0-9]+$/.test(trimmed)) return trimmed
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    try {
      return BigInt(trimmed).toString(10)
    } catch {
      return null
    }
  }
  return null
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
    rateLimitKey('relay:execute-gasless', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const apiKey = resolveRelayApiKey()
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'Relay execute-gasless not configured (missing RELAY_API_KEY).',
    } satisfies ApiEnvelope<never>)
  }

  let body: ExecuteGaslessRequest
  try {
    body = (await readJsonBody(req, {
      maxBytes: RELAY_EXECUTE_GASLESS_BODY_MAX_BYTES,
    })) as ExecuteGaslessRequest
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  if (!isHex32(body.requestId)) {
    return res.status(400).json({ success: false, error: 'requestId must be a 32-byte hex string' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressString(body.user)) {
    return res.status(400).json({ success: false, error: 'user must be an address' } satisfies ApiEnvelope<never>)
  }
  const chainId = typeof body.chainId === 'number' ? body.chainId : Number(body.chainId)
  if (!Number.isFinite(chainId) || chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'chainId must be 8453 (Base mainnet)' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressString(body.to) || !isHexData(body.data)) {
    return res.status(400).json({
      success: false,
      error: 'to must be address and data must be hex string',
    } satisfies ApiEnvelope<never>)
  }
  const value = hexOrDecimalToDecimalString(body.value ?? '0x0')
  if (value == null) {
    return res.status(400).json({
      success: false,
      error: 'value must be hex or decimal integer string',
    } satisfies ApiEnvelope<never>)
  }

  const upstreamPayload = {
    executionKind: 'rawCalls',
    requestId: body.requestId,
    data: {
      user: body.user,
      chainId,
      calls: [
        {
          to: body.to,
          data: body.data,
          value,
        },
      ],
    },
    executionOptions: {},
  }

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(RELAY_EXECUTE_GASLESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(upstreamPayload),
    })
  } catch {
    return res.status(502).json({
      success: false,
      error: 'Failed to reach Relay execute endpoint',
    } satisfies ApiEnvelope<never>)
  }

  const text = await upstreamRes.text().catch(() => '')
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!upstreamRes.ok) {
    const message =
      parsed && typeof parsed === 'object'
        ? String(
            (parsed as Record<string, unknown>).message ??
              (parsed as Record<string, unknown>).error ??
              '',
          )
        : String(parsed ?? '')
    return res.status(upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502).json({
      success: false,
      error: message
        ? `Relay /execute (${upstreamRes.status}): ${message}`
        : `Relay /execute failed with status ${upstreamRes.status}`,
      status: upstreamRes.status,
      data: parsed,
    })
  }

  return res.status(200).json({ success: true, data: parsed } satisfies ApiEnvelope<unknown>)
}

