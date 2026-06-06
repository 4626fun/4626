import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '@4626/server-core'

import { handleProliquidTelegramWebhookIngress } from './webhook/proliquidWebhookIngress.js'
import { readProliquidSignalConfig } from '../../../server/_lib/alfaclub/proliquidSignals.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    const config = readProliquidSignalConfig()
    return res.status(200).json({
      success: true,
      data: {
        ok: true,
        lane: 'proliquid',
        endpoint: 'proliquid-webhook',
        enabled: config.enabled,
      },
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  return handleProliquidTelegramWebhookIngress(req, res)
}
