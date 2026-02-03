import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../server/_lib/agentApiGuard.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/build/notImplemented',
    kind: 'build',
  })
  if (!g.ok) return

  return res.status(501).json({
    success: false,
    error: 'This build endpoint is not implemented in this deployment.',
    path: req.url ?? '',
  })
}

