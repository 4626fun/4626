import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { readProviderSourceDashboard } from '../../../../server/_lib/farcasterRolloutTelemetry.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const hoursRaw = typeof req.query.hours === 'string' ? Number(req.query.hours) : null
  const hours = Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : undefined

  const dashboard = await readProviderSourceDashboard({ hours })
  return res.status(200).json({ success: true, data: dashboard } satisfies ApiEnvelope<typeof dashboard>)
}
