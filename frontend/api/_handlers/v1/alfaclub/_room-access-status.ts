import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  getSessionAddress,
  isAdminAddress,
  guardAgentApiRequest,
  handleOptions,
  setCors,
  setNoStore,
  checkRateLimit,
  rateLimitKey,
  RATE_LIMITS,
  getClientIp,
} from '@4626/server-core'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'
import {
  readAlfaClubRoomAccessMembership,
  readAlfaClubRoomAccessPolicy,
} from '../../../../server/_lib/alfaclub/roomAccessPolicy.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/alfaclub/room-access/status', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1/alfaclub/room-access/status', (g.auth?.address ?? 'anon').toLowerCase(), getClientIp(req)),
    RATE_LIMITS.read,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const requesterAddress = normalizeChatAddress(g.auth?.address)
  const sessionAddress = normalizeChatAddress(getSessionAddress(req))
  const isAdmin = Boolean(sessionAddress && isAdminAddress(sessionAddress))
  const overrideWalletRaw = req.query.wallet
  const overrideWallet = normalizeChatAddress(
    typeof overrideWalletRaw === 'string'
      ? overrideWalletRaw
      : Array.isArray(overrideWalletRaw)
        ? String(overrideWalletRaw[0] ?? '')
        : null,
  )
  const walletAddress = overrideWallet && isAdmin ? overrideWallet : requesterAddress
  const roomIdRaw = req.query.roomId
  const roomId = typeof roomIdRaw === 'string' ? roomIdRaw.trim() : Array.isArray(roomIdRaw) ? String(roomIdRaw[0] ?? '').trim() : ''
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })

  const policy = await readAlfaClubRoomAccessPolicy(roomId)
  const membership = policy && walletAddress
    ? await readAlfaClubRoomAccessMembership({ roomId, walletAddress })
    : null

  return res.status(200).json({
    success: true,
    data: {
      policy,
      membership,
      canJoin: Boolean(policy?.enabled),
      generatedAt: new Date().toISOString(),
    },
  })
}
