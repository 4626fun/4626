import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  enforceCookieSessionTrustedOrigin,
  getSessionAddress,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  CreatorCoinLinkError,
  inspectCreatorCoinLink,
  readCreatorCoinLinkStatus,
} from '../../../../server/_lib/alfaclub/creatorCoinLink.js'

function queryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? '').trim() : String(value ?? '').trim()
}

function sendError(res: VercelResponse, error: unknown) {
  if (error instanceof CreatorCoinLinkError) {
    return res.status(error.status).json({ success: false, error: error.code, message: error.message })
  }
  return res.status(500).json({ success: false, error: 'creator_coin_status_failed' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  if (req.method === 'POST' && enforceCookieSessionTrustedOrigin(req, res)) return

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'authentication_required' })
  }

  try {
    if (req.method === 'GET') {
      const roomId = queryString(req.query.roomId)
      const data = await readCreatorCoinLinkStatus({ sessionAddress, roomId })
      return res.status(200).json({ success: true, data })
    }

    const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) ?? {}
    const data = await inspectCreatorCoinLink({
      sessionAddress,
      roomId: typeof body.roomId === 'string' ? body.roomId : '',
      creatorCoinAddress:
        typeof body.creatorCoinAddress === 'string' ? body.creatorCoinAddress : '',
      executionAddress: typeof body.executionAddress === 'string' ? body.executionAddress : '',
    })
    return res.status(200).json({ success: true, data })
  } catch (error) {
    return sendError(res, error)
  }
}
