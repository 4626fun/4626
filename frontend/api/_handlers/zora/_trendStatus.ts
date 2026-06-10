import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  setNoStore,
  readRequestPrincipal,
  isAdminAddress,
} from '@4626/server-core'

import { getNumberQuery, getStringQuery, handleOptions, setCors } from '../../../server/zora/_shared.js'


import { getTrendOpByTickerHash, listRecentTrendOps } from '../../../server/_lib/zora/zoraTrendOpsStore.js'
import { preflightTrendTicker } from '../../../server/zora/trends.js'

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

  const ticker = getStringQuery(req, 'ticker')
  if (!ticker) {
    const limit = Math.max(1, Math.min(getNumberQuery(req, 'limit') ?? 20, 100))
    const recent = await listRecentTrendOps(limit)
    setNoStore(res)
    return res.status(200).json({
      success: true,
      data: {
        recent,
      },
    })
  }

  try {
    const preflight = await preflightTrendTicker({ ticker })
    const stored = await getTrendOpByTickerHash(preflight.tickerHash)
    setNoStore(res)
    return res.status(200).json({
      success: true,
      data: {
        ticker: preflight.ticker,
        preflight,
        stored,
      },
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: String(error?.message ?? 'trend_status_failed').slice(0, 220),
    })
  }
}

