import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '@4626/server-core'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Legacy server-relay path retired — use burn-credits + submit-zk (ZK proof).
  return res.status(410).json({ success: false, error: 'legacy_amoe_submit_retired' })
}
