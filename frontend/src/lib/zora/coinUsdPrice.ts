import type { ZoraCoin } from '@/lib/zora/types'

/** Resolve a Zora creator coin spot USD price from API fields when available. */
export function resolveZoraCoinUsdPrice(coin: ZoraCoin | null | undefined): number | null {
  if (!coin) return null

  const direct = Number(coin.tokenPrice?.priceInUsdc ?? '')
  if (Number.isFinite(direct) && direct > 0) return direct

  const marketCap = Number(coin.marketCap ?? '')
  const totalSupply = Number(coin.totalSupply ?? '')
  if (Number.isFinite(marketCap) && marketCap > 0 && Number.isFinite(totalSupply) && totalSupply > 0) {
    return marketCap / totalSupply
  }

  return null
}
