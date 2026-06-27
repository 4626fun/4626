import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  readSessionFromRequest,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkDurableRateLimit,
  rateLimitKey,
} from '@4626/server-core'
import { isKeeperWriteCommandText } from '../../../../server/agents/eliza/plugins/keeperOps/index.js'
import { isHermitUserAllowed } from '../../../../server/_lib/hermit/policy.js'
import { executeHermitCommand } from '../../../../server/_lib/hermit/skillRouter.js'

type HermitBody = {
  source?: string
  command?: string
}

const MAX_COMMAND_LENGTH = 2_000
const MAX_SOURCE_LENGTH = 32

function asBoundedTrimmed(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isHermitSource(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized === 'hermit' ||
    normalized === 'pinata' ||
    normalized === 'pinata-agent' ||
    normalized === 'pinata_agent'
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-chat-hermit', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? (rawBody as HermitBody)
    : {}

  const source = asBoundedTrimmed(body.source, MAX_SOURCE_LENGTH).toLowerCase()
  if (!isHermitSource(source)) {
    return res.status(400).json({
      success: false,
      error: 'source must be hermit',
    } satisfies ApiEnvelope<never>)
  }

  const command = asBoundedTrimmed(body.command, MAX_COMMAND_LENGTH)
  if (!command) {
    return res.status(400).json({
      success: false,
      error: 'command is required',
    } satisfies ApiEnvelope<never>)
  }

  if (isKeeperWriteCommandText(command)) {
    return res.status(403).json({
      success: false,
      error: 'Hermit lane is read-only',
    } satisfies ApiEnvelope<never>)
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = String(session?.address ?? '').trim().toLowerCase()
  if (!isAddressLike(sessionAddress)) {
    return res.status(401).json({
      success: false,
      error: 'Sign in required',
    } satisfies ApiEnvelope<never>)
  }

  if (!isHermitUserAllowed(sessionAddress)) {
    return res.status(403).json({
      success: false,
      error: 'Hermit access denied',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await executeHermitCommand({
      commandText: command,
      senderAddress: sessionAddress as `0x${string}`,
    })
    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hermit request failed'
    return res.status(400).json({
      success: false,
      error: message.slice(0, 240),
    } satisfies ApiEnvelope<never>)
  }
}
