import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
} from '../../../../packages/server-core/src/index.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  return res.status(410).json({
    success: false,
    error: 'xmtp_checkin_auto_only',
    message: 'XMTP AMOE credits are now awarded automatically after server-verified inbound messages to agent 4626.',
  })
}

