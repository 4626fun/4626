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
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { softDeleteHermitMeme } from '../../../../server/_lib/hermit/repository.js'
import { isHermitOwner, isHermitRoomAllowedForOwner } from '../../../../server/_lib/hermit/policy.js'

type DeleteMemeBody = {
  memeId?: number
  roomId?: string
}

const MAX_ROOM_ID_LENGTH = 64

function asTrimmed(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-hermit-meme-delete', getClientIp(req)),
    RATE_LIMITS.adminAction,
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
  if (!isHermitOwner(sessionAddress)) {
    return res.status(403).json({
      success: false,
      error: 'Hermit owner only',
    } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? (rawBody as DeleteMemeBody)
    : {}
  const memeId = asPositiveInt(body.memeId)
  const roomId = asTrimmed(body.roomId, MAX_ROOM_ID_LENGTH)
  const roomAllowed = roomId
    ? await isHermitRoomAllowedForOwner({ roomId, ownerAddress: sessionAddress })
    : false
  if (!memeId || !roomId || !roomAllowed) {
    return res.status(400).json({
      success: false,
      error: 'memeId and valid roomId are required',
    } satisfies ApiEnvelope<never>)
  }

  const deleted = await softDeleteHermitMeme({
    id: memeId,
    ownerAddress: sessionAddress,
    roomId,
  })
  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Meme not found',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: { deleted: true, memeId },
  } satisfies ApiEnvelope<{ deleted: true; memeId: number }>)
}
