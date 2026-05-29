import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getSessionAddress,
  isAdminAddress,
  guardAgentApiRequest,
  handleOptions,
  rateLimitKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'
import { joinAlfaClubRoomAccess } from '../../../../server/_lib/alfaclub/roomAccessPolicy.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/alfaclub/room-access/join', kind: 'write' })
  if (!g.ok) return

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
  if (!walletAddress) return res.status(401).json({ success: false, error: 'Authentication required' })

  const limiter = checkRateLimit(
    rateLimitKey('v1-alfaclub-room-access-join', walletAddress, roomId, getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  try {
    const result = await joinAlfaClubRoomAccess({ roomId, walletAddress })
    return res.status(result.eligible ? 200 : 403).json({
      success: result.eligible,
      data: result,
      error: result.eligible ? undefined : 'not_eligible',
    })
  } catch (error: any) {
    const message = error?.message ? String(error.message) : 'room_access_join_failed'
    const status = message.includes('not_enabled') ? 409 : 500
    return res.status(status).json({ success: false, error: message })
  }
}
