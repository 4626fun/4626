import type { VercelRequest, VercelResponse } from '@vercel/node'

import { setNoStore } from '../../../server/auth/_shared.js'
import { getNumberQuery, handleOptions, setCors } from '../../../server/zora/_shared.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'
import { getTrendOpsMetrics, listRecentTrendOps } from '../../../server/_lib/zoraTrendOpsStore.js'

function isAuthorizedAdmin(req: VercelRequest): boolean {
  const principal = readRequestPrincipal(req)
  if (!principal?.address) return false
  return isAdminAddress(principal.address as `0x${string}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' })
  }

  const hours = Math.max(1, Math.min(getNumberQuery(req, 'hours') ?? 24, 24 * 30))
  const limit = Math.max(1, Math.min(getNumberQuery(req, 'limit') ?? 20, 100))

  try {
    const [metrics, recent] = await Promise.all([getTrendOpsMetrics(hours), listRecentTrendOps(limit)])
    setNoStore(res)
    return res.status(200).json({
      success: true,
      data: {
        metrics,
        recent,
      },
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: String(error?.message ?? 'trend_metrics_failed').slice(0, 220),
    })
  }
}

