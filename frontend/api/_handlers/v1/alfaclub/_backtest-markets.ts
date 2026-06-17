import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { getPerpMarkets } from '../../../../server/_lib/alfaclub/hyperliquid.js'

const FALLBACK_MARKETS: Array<{ symbol: string; market: string; maxLeverage: number | null }> = [
  { symbol: 'BTC', market: 'BTC/USDC', maxLeverage: 40 },
  { symbol: 'ETH', market: 'ETH/USDC', maxLeverage: 40 },
  { symbol: 'SOL', market: 'SOL/USDC', maxLeverage: 40 },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-backtest-markets', getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const markets = await getPerpMarkets()
  const normalized = (markets ?? [])
    .map((row) => ({
      symbol: row.symbol,
      market: `${row.symbol}/USDC`,
      maxLeverage: row.maxLeverage,
    }))
    .filter((row) => row.symbol.length > 0)

  return res.status(200).json({
    success: true,
    data: {
      markets: normalized.length > 0 ? normalized : FALLBACK_MARKETS,
      source: normalized.length > 0 ? 'hyperliquid' : 'fallback',
    },
  } satisfies ApiEnvelope<{
    markets: Array<{ symbol: string; market: string; maxLeverage: number | null }>
    source: 'hyperliquid' | 'fallback'
  }>)
}
