import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCors } from '@4626/server-core'
import { fetchServerMigratedCoins } from '../../../server/_lib/zora/migratedCoins.js'

function setCache(res: VercelResponse, seconds: number = 3600) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const forceRefresh = String(req.query?.refresh ?? '').trim() === '1'
    const { addresses, lastUpdated } = await fetchServerMigratedCoins({ forceRefresh })
    setCache(res)
    return res.status(200).json({
      success: true,
      addresses: Array.from(addresses),
      count: addresses.size,
      lastUpdated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch migrated coins'
    return res.status(500).json({ success: false, error: message })
  }
}
