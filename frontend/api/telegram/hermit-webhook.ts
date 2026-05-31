/**
 * Dedicated Hermit bot webhook — works on app.4626.fun without host-based ingress.
 *
 * Register hermit4626bot to:
 *   https://app.4626.fun/api/telegram/hermit-webhook
 *
 * When hermit.4626.fun DNS points at Vercel, vercel.json rewrites
 * /api/telegram/webhook on that host here as well.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '@4626/server-core'

import { handleHermitTelegramWebhookIngress } from '../_handlers/telegram/webhook/hermitWebhookIngress.js'

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
