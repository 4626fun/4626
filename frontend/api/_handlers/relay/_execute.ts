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

/**
 * `/api/relay/execute` — server-side proxy to Relay Protocol's gasless execution
 * endpoint (`https://api.relay.link/execute`).
 *
 * Why this proxy exists:
 *  - The Mar 9 2026 owner[2] install (tx 0x801b9d4b…) was relayed by
 *    `RelayRouterV3.multicall(EntryPoint.handleOps + Relay.refund)`. The trace
 *    shows the inner UserOp was passkey-signed against
 *    `getUserOpHashWithoutChainId(userOp)` with `gas=0` and
 *    `paymasterAndData=""`, then submitted via Relay's `/execute` endpoint
 *    with `executionKind: 'rawCalls'` carrying pre-encoded `handleOps`
 *    calldata. Reference:
 *    https://docs.relay.link/features/gasless-execution
 *  - Relay's `/execute` requires an API key passed in the `x-api-key` header.
 *    We hold that key server-side and never expose it to the browser.
 *
 * Request body (POST, JSON):
 *   {
 *     chainId: 8453,
 *     to: "0x...",         // EntryPoint v0.6 or v0.7 address
 *     data: "0x...",       // EntryPoint.handleOps([signedUserOp], beneficiary)
 *     value?: "0"          // optional, defaults to "0"
 *   }
 *
 * Response body:
 *   { success: true,  data: <relay /execute response>  }
 *   { success: false, error: <message>, status: <upstream status> }
 *
 * Notes:
 *   - We do NOT forward arbitrary bodies. The handler validates shape and
 *     rebuilds the payload to ensure only the intended fields reach Relay.
 *   - The frontend is responsible for building the signed UserOp and the
 *     `handleOps` calldata. This proxy is a thin authenticated forwarder.
 */

type RelayExecuteRequest = {
  chainId?: unknown
  to?: unknown
  data?: unknown
  value?: unknown
}

type RelayExecuteSuccess = ApiEnvelope<unknown>
type RelayExecuteError = {
  success: false
  error: string
  status?: number
  data?: unknown
}

const RELAY_EXECUTE_URL = 'https://api.relay.link/execute'
const HANDLE_OPS_SELECTOR = '0x1fad948c' // EntryPoint.handleOps((userOp[]),beneficiary)
const ENTRY_POINT_V06 = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'
const ENTRY_POINT_V07 = '0x0000000071727de22e5e9d8baf0edac6f37da032'
const ALLOWED_TO = new Set([ENTRY_POINT_V06, ENTRY_POINT_V07])
const ALLOWED_CHAIN_IDS = new Set([8453]) // Base mainnet only

function isHexString(value: unknown, minBytes: number): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('0x')) return false
  // 2 chars per byte + the '0x' prefix
  return value.length >= 2 + minBytes * 2
}

function isAddressString(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function resolveRelayApiKey(): string | null {
  const candidates = [
    'RELAY_API_KEY',
    'VITE_RELAY_API_KEY',
    'RELAY_LINK_API_KEY',
  ]
  for (const key of candidates) {
    const raw = (globalThis as any)?.process?.env?.[key]
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('relay:execute', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res
      .status(429)
      .json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: RelayExecuteRequest
  try {
    body = (await readJsonBody(req)) as RelayExecuteRequest
  } catch {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const chainId = typeof body.chainId === 'number' ? body.chainId : NaN
  if (!ALLOWED_CHAIN_IDS.has(chainId)) {
    return res.status(400).json({
      success: false,
      error: 'chainId must be 8453 (Base mainnet)',
    } satisfies ApiEnvelope<never>)
  }

  const toRaw = typeof body.to === 'string' ? body.to.toLowerCase() : ''
  if (!isAddressString(body.to) || !ALLOWED_TO.has(toRaw)) {
    return res.status(400).json({
      success: false,
      error: 'to must be the EntryPoint v0.6 or v0.7 address',
    } satisfies ApiEnvelope<never>)
  }

  // Validate that the calldata is at least a handleOps selector. We don't
  // decode the UserOp on-server (that's the frontend's responsibility), but we
  // do guard against accidentally proxying arbitrary calls through Relay.
  if (!isHexString(body.data, 4)) {
    return res.status(400).json({
      success: false,
      error: 'data must be hex-encoded handleOps calldata',
    } satisfies ApiEnvelope<never>)
  }
  const dataLower = (body.data as string).toLowerCase()
  if (!dataLower.startsWith(HANDLE_OPS_SELECTOR)) {
    return res.status(400).json({
      success: false,
      error: `data must start with EntryPoint.handleOps selector (${HANDLE_OPS_SELECTOR})`,
    } satisfies ApiEnvelope<never>)
  }

  const valueRaw = typeof body.value === 'string' && body.value.trim() ? body.value.trim() : '0'
  if (valueRaw !== '0' && valueRaw !== '0x0') {
    return res.status(400).json({
      success: false,
      error: 'value must be "0" — the Relay solver covers gas',
    } satisfies ApiEnvelope<never>)
  }

  const apiKey = resolveRelayApiKey()
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'Relay API key is not configured on this deployment',
    } satisfies ApiEnvelope<never>)
  }

  const upstreamPayload = {
    executionKind: 'rawCalls',
    data: {
      chainId,
      to: body.to,
      data: body.data,
      value: '0',
    },
  }

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(RELAY_EXECUTE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamPayload),
    })
  } catch (error) {
    logger.warn('[relay/execute] upstream fetch failed', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
    return res.status(502).json({
      success: false,
      error: 'Failed to reach Relay /execute',
    } satisfies ApiEnvelope<never>)
  }

  let upstreamBody: unknown = null
  let upstreamText = ''
  try {
    upstreamText = await upstreamRes.text()
  } catch {
    upstreamText = ''
  }
  if (upstreamText) {
    try {
      upstreamBody = JSON.parse(upstreamText)
    } catch {
      upstreamBody = upstreamText
    }
  }

  if (!upstreamRes.ok) {
    const errorPayload: RelayExecuteError = {
      success: false,
      error: typeof upstreamBody === 'string'
        ? upstreamBody
        : `Relay /execute failed with status ${upstreamRes.status}`,
      status: upstreamRes.status,
    }
    if (upstreamBody && typeof upstreamBody === 'object') {
      errorPayload.data = upstreamBody
    }
    return res
      .status(upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502)
      .json(errorPayload)
  }

  return res
    .status(200)
    .json({ success: true, data: upstreamBody } satisfies RelayExecuteSuccess)
}
