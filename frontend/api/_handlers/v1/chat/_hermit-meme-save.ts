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
} from '@4626/server-core'
import { createHermitMeme } from '../../../../server/_lib/hermit/repository.js'
import { isHermitOwner, isHermitRoomAllowedForOwner, resolveHermitGatewayUrl } from '../../../../server/_lib/hermit/policy.js'

type SaveMemeBody = {
  roomId?: string
  cid?: string
  url?: string
  caption?: string
  tags?: unknown
}

const MAX_ROOM_ID_LENGTH = 64
const MAX_CID_LENGTH = 128
const MAX_URL_LENGTH = 1024
const MAX_CAPTION_LENGTH = 280

function asTrimmed(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter(Boolean)
    .slice(0, 12)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-hermit-meme-save', getClientIp(req)),
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

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: 32_768 })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? (rawBody as SaveMemeBody)
    : {}
  const roomId = asTrimmed(body.roomId, MAX_ROOM_ID_LENGTH)
  const roomAllowed = roomId
    ? await isHermitRoomAllowedForOwner({ roomId, ownerAddress: sessionAddress })
    : false
  if (!roomId || !roomAllowed) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or disallowed roomId',
    } satisfies ApiEnvelope<never>)
  }

  const cid = asTrimmed(body.cid, MAX_CID_LENGTH)
  const urlInput = asTrimmed(body.url, MAX_URL_LENGTH)
  const url = urlInput || (cid ? resolveHermitGatewayUrl(cid) ?? '' : '')
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'url or cid is required',
    } satisfies ApiEnvelope<never>)
  }
  const caption = asTrimmed(body.caption, MAX_CAPTION_LENGTH) || 'Hermit meme drop.'
  const tags = normalizeTags(body.tags)

  const saved = await createHermitMeme({
    ownerAddress: sessionAddress,
    roomId,
    cid: cid || null,
    url,
    caption,
    tags,
    createdBy: sessionAddress,
  })
  if (!saved) {
    return res.status(503).json({
      success: false,
      error: 'Hermit meme store unavailable',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      meme: saved,
    },
  } satisfies ApiEnvelope<{ meme: unknown }>)
}
