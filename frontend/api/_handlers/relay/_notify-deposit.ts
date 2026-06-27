import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'
import { notifyRelaySolverDeposit } from '../../../server/_lib/relay/notifyRelaySolverDeposit.js'

const BODY_MAX_BYTES = 8 * 1024
const BASE_MAINNET_CHAIN_ID = 8453

type NotifyDepositBody = {
  chainId?: unknown
  depositTxHash?: unknown
  requestId?: unknown
  indexRequestIds?: unknown
  userCall?: unknown
  referrer?: unknown
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isRequestId(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isHexCalldata(value: unknown): value is `0x${string}` {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return false
  const byteLen = (value.length - 2) / 2
  return byteLen >= 4 && byteLen <= 128_000
}

function parseUserCall(value: unknown):
  | { to: `0x${string}`; data: `0x${string}`; value: string }
  | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  if (!isAddress(obj.to) || !isHexCalldata(obj.data)) return null
  const rawValue = obj.value
  if (typeof rawValue !== 'string' || !rawValue.trim()) return null
  const normalized = rawValue.trim()
  if (/^0x[0-9a-fA-F]+$/.test(normalized) || /^[0-9]+$/.test(normalized)) {
    return { to: obj.to, data: obj.data, value: normalized }
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

  const limiter = await checkDurableRateLimit(
    rateLimitKey('relay:notify-deposit', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  let body: NotifyDepositBody
  try {
    const parsed = await readJsonBody<NotifyDepositBody>(req, { maxBytes: BODY_MAX_BYTES })
    if (!parsed || typeof parsed !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON body',
      } satisfies ApiEnvelope<never>)
    }
    body = parsed
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body',
    } satisfies ApiEnvelope<never>)
  }

  const chainId =
    typeof body.chainId === 'number' && Number.isFinite(body.chainId)
      ? Math.trunc(body.chainId)
      : typeof body.chainId === 'string' && /^[0-9]+$/.test(body.chainId.trim())
        ? Number(body.chainId.trim())
        : null

  if (chainId !== BASE_MAINNET_CHAIN_ID) {
    return res.status(400).json({
      success: false,
      error: `chainId must be ${BASE_MAINNET_CHAIN_ID} (Base mainnet)`,
    } satisfies ApiEnvelope<never>)
  }

  if (!isTxHash(body.depositTxHash)) {
    return res.status(400).json({
      success: false,
      error: 'depositTxHash must be a 32-byte 0x-prefixed transaction hash',
    } satisfies ApiEnvelope<never>)
  }

  const indexRequestIds: `0x${string}`[] = []
  const pushRequestId = (value: unknown) => {
    if (!isRequestId(value)) return
    const lower = value.toLowerCase()
    if (indexRequestIds.some((existing) => existing.toLowerCase() === lower)) return
    indexRequestIds.push(value)
  }
  if (Array.isArray(body.indexRequestIds)) {
    for (const candidate of body.indexRequestIds) {
      pushRequestId(candidate)
    }
  }
  pushRequestId(body.requestId)

  const userCall = parseUserCall(body.userCall)
  const referrer =
    typeof body.referrer === 'string' && body.referrer.trim() ? body.referrer.trim().slice(0, 64) : undefined

  try {
    const result = await notifyRelaySolverDeposit({
      chainId,
      depositTxHash: body.depositTxHash,
      indexRequestIds: indexRequestIds.length > 0 ? indexRequestIds : undefined,
      userCall,
      referrer,
    })

    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<typeof result>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to notify Relay solver'
    return res.status(500).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }
}
