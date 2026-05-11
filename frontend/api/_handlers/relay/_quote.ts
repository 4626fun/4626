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
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'
// NOTE: Unlike /api/relay/execute (which is locked to EntryPoint.handleOps),
// /api/relay/quote forwards an arbitrary inner tx into Relay's /quote/v2 so the
// CSW self-call lane (to = CSW, data = executeWithoutChainIdValidation(...))
// can fetch a sponsored deposit step. We therefore only validate that `to` is
// a 20-byte address and `data` is hex calldata — Relay validates the rest.

type RelayQuoteRequest = {
  chainId?: unknown
  to?: unknown
  data?: unknown
  value?: unknown
  user?: unknown
  amount?: unknown
  /**
   * Optional. When omitted, defaults to `user` (the legacy single-wallet
   * shape used by /remove-owner's earlier prepareCalls lane). When provided,
   * forwarded to Relay so the quote uses a distinct recipient (e.g. funder
   * EOA pays, CSW receives the executed call). See RELAY_OWNER_MUTATION_FLOW.md
   * for the two-wallet architecture.
   */
  recipient?: unknown
  /** Optional. Defaults to `chainId` (same-chain) when omitted. */
  originChainId?: unknown
  /** Optional. Defaults to `chainId` (same-chain) when omitted. */
  destinationChainId?: unknown
}

function isAddressString(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

// Strict 0x-prefixed hex check. Enforces:
//   - lowercase/uppercase hex charset only (no junk like 0xzzz...)
//   - even number of hex chars (whole bytes)
//   - minimum byte length (e.g. 4 for a function selector)
//   - optional maximum byte length to bound forwarded calldata size
function isHexString(value: unknown, minBytes: number, maxBytes: number = 128_000): value is string {
  if (typeof value !== 'string') return false
  if (!/^0x[0-9a-fA-F]*$/.test(value)) return false
  const hexChars = value.length - 2
  if (hexChars % 2 !== 0) return false
  const byteLen = hexChars / 2
  return byteLen >= minBytes && byteLen <= maxBytes
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
  if (!isAddressString(body.to)) {
    return res.status(400).json({ success: false, error: 'to must be a 20-byte address' } satisfies ApiEnvelope<never>)
  }
  if (!isHexString(body.data, 4)) {
    return res.status(400).json({
      success: false,
      error: 'data must be 0x-prefixed hex calldata with an even number of hex chars and at least 4 bytes (function selector)',
    } satisfies ApiEnvelope<never>)
  }
  const valueRaw = typeof body.value === 'string' && body.value.trim() ? body.value.trim() : '0'
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(valueRaw)) {
    return res.status(400).json({ success: false, error: 'value must be a decimal or hex integer string' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressString(body.user)) {
    return res.status(400).json({ success: false, error: 'user must be the CSW address' } satisfies ApiEnvelope<never>)
  }
  const amountRaw = typeof body.amount === 'string' && body.amount.trim() ? body.amount.trim() : valueRaw
  if (!/^[0-9]+$/.test(amountRaw)) {
    return res.status(400).json({ success: false, error: 'amount must be a decimal integer string' } satisfies ApiEnvelope<never>)
  }

  // recipient defaults to user (legacy single-wallet behavior). When the
  // caller wants the funder/recipient split (see RELAY_OWNER_MUTATION_FLOW.md),
  // they pass `recipient` explicitly and we forward it. Validate it's a real
  // address before trusting it.
  let recipient: string = body.user
  if (body.recipient !== undefined && body.recipient !== null && body.recipient !== '') {
    if (!isAddressString(body.recipient)) {
      return res.status(400).json({
        success: false,
        error: 'recipient must be a 20-byte address when provided',
      } satisfies ApiEnvelope<never>)
    }
    recipient = body.recipient
  }
  // origin / destination chain ids default to the same `chainId` for the
  // legacy same-chain shape. Cross-chain callers can override.
  const originChainId =
    typeof body.originChainId === 'number' && Number.isFinite(body.originChainId)
      ? body.originChainId
      : chainId
  const destinationChainId =
    typeof body.destinationChainId === 'number' && Number.isFinite(body.destinationChainId)
      ? body.destinationChainId
      : chainId
  const upstreamPayload = {
    user: body.user,
    recipient,
    originChainId,
    destinationChainId,
    originCurrency: NATIVE_CURRENCY,
    destinationCurrency: NATIVE_CURRENCY,
    amount: amountRaw,
    tradeType: 'EXACT_OUTPUT',
    explicitDeposit: true,
    txs: [{ to: body.to, data: body.data, value: valueRaw }],
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
