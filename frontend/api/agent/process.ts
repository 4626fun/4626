/**
 * Vercel entry for /api/agent/process.
 *
 * Production XMTP consumption runs on the Railway primary (see README runtime
 * split). Deploying the full `_process` handler here pulls @xmtp/node-bindings
 * (~250 MB+ even after platform excludes) and fails Vercel's function size limit.
 *
 * The real handler remains at `api/_handlers/agent/_process.ts` for Railway,
 * tests, and local tooling.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  return res.status(503).json({
    success: false,
    error: 'agent_process_not_on_vercel',
    message:
      'XMTP agent processing is handled by the Railway primary runtime, not Vercel serverless functions.',
  })
}
