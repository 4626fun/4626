import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { recheckAlfaClubRoomAccessMemberships } from '../../../../server/_lib/alfaclub/roomAccessPolicy.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  if (!requireKeeprApiKey(req, res)) return

  const roomIdRaw = req.query.roomId
  const roomId = typeof roomIdRaw === 'string' ? roomIdRaw.trim() : Array.isArray(roomIdRaw) ? String(roomIdRaw[0] ?? '').trim() : ''
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId is required' })

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 2048 })) ?? {}
  const limit = Number(body.limit ?? req.query.limit ?? 100)

  try {
    const result = await recheckAlfaClubRoomAccessMemberships({ roomId, limit })
    return res.status(200).json({ success: true, data: result })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message ? String(error.message) : 'room_access_recheck_failed',
    })
  }
}
