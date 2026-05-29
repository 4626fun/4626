import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getDb } from '@4626/server-core'
import { resolveCoinPriceSparkline } from '../../../server/_lib/zora/coinPriceSparkline.js'
import { persistExploreSparklinesToDb } from '../../../server/_lib/zora/exploreSparklineCache.js'
import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  isAddressLike,
  requireServerKey,
  setCache,
  setCors,
} from '../../../server/zora/_shared.js'

const MAX_COINS = 25

function parseCoinAddresses(raw: string | null): string[] {
  if (!raw) return []
  const parts = raw.split(',').map((value) => value.trim().toLowerCase())
  const unique: string[] = []
  for (const part of parts) {
    if (!isAddressLike(part)) continue
    if (!unique.includes(part)) unique.push(part)
    if (unique.length >= MAX_COINS) break
  }
  return unique
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const key = requireServerKey()
  const hasGraphKey = Boolean(process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY)
  if (!key && !hasGraphKey) {
    return res.status(503).json({
      success: false,
      error: 'Neither ZORA_SERVER_API_KEY nor THEGRAPH_API_KEY is configured',
    })
  }

  const coins = parseCoinAddresses(getStringQuery(req, 'coins') ?? getStringQuery(req, 'addresses'))
  if (coins.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or invalid coins query (comma-separated addresses)' })
  }

  const chain = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID

  try {
    let sdk: any = null
    if (key) {
      sdk = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(key)
    }

    const results = await Promise.allSettled(
      coins.map((coinAddress) => resolveCoinPriceSparkline(coinAddress, { sdk, chainId: chain })),
    )

    const sparklines: Record<
      string,
      { values: number[]; changePercent: number | null }
    > = {}

    const fulfilled = results
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof resolveCoinPriceSparkline>>> =>
        result.status === 'fulfilled',
      )
      .map((result) => result.value)

    for (const row of fulfilled) {
      if (!row.coinAddress || row.values.length < 2) continue
      sparklines[row.coinAddress] = {
        values: row.values,
        changePercent: row.changePercent,
      }
    }

    const db = await getDb().catch(() => null)
    if (db) {
      void persistExploreSparklinesToDb(db, fulfilled).catch(() => undefined)
    }

    setCache(res, 300)
    return res.status(200).json({ success: true, data: { sparklines } })
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    return res.status(status).json({
      success: false,
      error: error?.message || 'Failed to fetch explore sparklines',
    })
  }
}
