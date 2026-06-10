import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readSessionFromRequest,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'
import { listHermitMemes } from '../../../../server/_lib/hermit/repository.js'
import { getHermitOwnerAddress, isHermitRoomAllowedForOwner } from '../../../../server/_lib/hermit/policy.js'

const MAX_ROOM_ID_LENGTH = 64
const MAX_TAG_LENGTH = 32
const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

function asTrimmed(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function asPositiveInt(value: unknown): number {
  const raw = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.floor(raw))
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-hermit-meme-list', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = String(session?.address ?? '').trim().toLowerCase()
  if (!isAddressLike(sessionAddress)) {
    return res.status(401).json({
      success: false,
      error: 'Sign in required',
    } satisfies ApiEnvelope<never>)
  }

  const roomId = asTrimmed(req.query.roomId, MAX_ROOM_ID_LENGTH)
  const ownerAddress = getHermitOwnerAddress()
  if (!ownerAddress) {
    return res.status(503).json({
      success: false,
      error: 'Hermit owner address is not configured',
    } satisfies ApiEnvelope<never>)
  }
  const roomAllowed = roomId
    ? await isHermitRoomAllowedForOwner({ roomId, ownerAddress })
    : false
  if (!roomId || !roomAllowed) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or disallowed roomId',
    } satisfies ApiEnvelope<never>)
  }
  const tag = asTrimmed(req.query.tag, MAX_TAG_LENGTH).toLowerCase()
  const limit = asPositiveInt(req.query.limit)

  const memes = await listHermitMemes({
    roomId,
    tag: tag || undefined,
    limit,
  })

  return res.status(200).json({
    success: true,
    data: {
      roomId,
      count: memes.length,
      memes,
    },
  } satisfies ApiEnvelope<{ roomId: string; count: number; memes: unknown[] }>)
}
