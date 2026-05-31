/**
 * POST/GET /api/telegram/hermit-webhook
 *
 * Dedicated Hermit bot ingress (hermit4626bot). Works on app.4626.fun without
 * relying on hermit.4626.fun DNS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '@4626/server-core'

import { handleHermitTelegramWebhookIngress } from './webhook/hermitWebhookIngress.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: { ok: true, lane: 'hermit', endpoint: 'hermit-webhook' },
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  return handleHermitTelegramWebhookIngress(req, res)
}
