import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'

import { listMyAlfaClubRoomIds } from '../../../server/_lib/alfaclub/alfaclubMyRooms.js'

type FriendKeyHoldingsResponse = {
  roomIds: string[]
  generatedAt: string
}

const CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 200
const cache = new Map<string, { roomIds: string[]; expiresAt: number }>()

function readCachedRoomIds(key: string): string[] | null {
  const cached = cache.get(key)
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return cached.roomIds
}

function writeCachedRoomIds(key: string, roomIds: string[]): void {
  cache.set(key, { roomIds, expiresAt: Date.now() + CACHE_TTL_MS })
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (typeof firstKey !== 'string') break
    cache.delete(firstKey)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res
      .status(401)
      .json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('wallet/friend-key-holdings', principalAddress, getClientIp(req)),
    RATE_LIMITS.read,
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

  try {
    const roomIds =
      readCachedRoomIds(principalAddress) ??
      (await listMyAlfaClubRoomIds(principalAddress)).roomIds
    writeCachedRoomIds(principalAddress, roomIds)
    const data: FriendKeyHoldingsResponse = {
      roomIds,
      generatedAt: new Date().toISOString(),
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<typeof data>)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'friend_key_holdings_read_failed'
    return res.status(502).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
