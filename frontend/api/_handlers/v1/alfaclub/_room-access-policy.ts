import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'
import {
  preloadAlfaClubRoomAccessPolicyPoolAddress,
  upsertAlfaClubRoomAccessPolicy,
} from '../../../../server/_lib/alfaclub/roomAccessPolicy.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const actorAddress = normalizeChatAddress(getSessionAddress(req))
  if (!actorAddress) return res.status(401).json({ success: false, error: 'Authentication required' })
  if (!isAdminAddress(actorAddress)) return res.status(403).json({ success: false, error: 'Admin only' })

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8192 })) ?? {}
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : ''
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId.trim() : String(body.tokenId ?? '').trim()
  const creatorCoinAddress = normalizeChatAddress(body.creatorCoinAddress)
  const explicitPoolAddress = normalizeChatAddress(body.poolAddress)
  const keyAmountRaw = typeof body.keyAmountRaw === 'string' ? body.keyAmountRaw.trim() : String(body.keyAmountRaw ?? '1')
  const enterThresholdBps = Number(body.enterThresholdBps ?? 10_000)
  const exitThresholdBps = Number(body.exitThresholdBps ?? 9_000)
  const graceHours = Number(body.graceHours ?? 24)
  const enabled = Boolean(body.enabled)

  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })
  if (!/^\d+$/.test(tokenId)) return res.status(400).json({ success: false, error: 'tokenId must be a positive integer string' })
  if (!creatorCoinAddress) return res.status(400).json({ success: false, error: 'creatorCoinAddress is required' })

  const resolvedPoolAddress =
    explicitPoolAddress
    ?? (await preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId,
      creatorCoinAddress,
      tokenId,
    }))
  if (!resolvedPoolAddress) {
    return res.status(400).json({
      success: false,
      error: 'poolAddress is required or discoverable via factory getPool',
    })
  }

  try {
    const policy = await upsertAlfaClubRoomAccessPolicy({
      roomId,
      tokenId,
      creatorCoinAddress,
      poolAddress: resolvedPoolAddress,
      keyAmountRaw,
      enterThresholdBps,
      exitThresholdBps,
      graceHours,
      enabled,
      actorAddress,
    })
    return res.status(200).json({ success: true, data: { policy } })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message ? String(error.message) : 'room_access_policy_update_failed',
    })
  }
}
