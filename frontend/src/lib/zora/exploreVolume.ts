import type { ZoraCoin } from './types'

/**
 * Zora coins explore API exposes rolling 24h volume per coin (`volume24h`) and cumulative
 * `totalVolume` (all-time). There is no true multi-day window on explore responses besides those two.
 */
export function getZoraExploreVolumeColumnRaw(coin: ZoraCoin, timeframe: string): string | undefined {
  if (timeframe === '1y') {
    const total = coin.totalVolume
    if (total != null && String(total).trim() !== '') return String(total)
    return coin.volume24h
  }
  return coin.volume24h
}

/** Always use 24h notional for fee estimates (fees accrue on recent trading; all-time volume would misstate fees). */
export function getZoraExploreVolumeForFees(coin: ZoraCoin): string | undefined {
  return coin.volume24h
}

/**
 * Short note under explore time pills so users are not misled by column headers vs API reality.
 */
export function getZoraExploreVolumeNote(timeframe: string): string | null {
  if (timeframe === '1d') return null
  if (timeframe === '1y') {
    return 'Volume column uses Zora all-time traded volume. With “Volume” sort, row order still follows the API’s 24h leaderboard.'
  }
  if (timeframe === '1w') {
    return 'Volume column still shows Zora’s 24h figure; a true 7D window is not on the coins explore API yet.'
  }
  return 'Volume column shows Zora’s 24h figure; this time range is not on the coins explore API.'
}

export function getZoraExploreVolumeHeaderLabel(timeframe: string): string {
  switch (timeframe) {
    case '1d':
      return 'Volume (24h)'
    case '1y':
      return 'All-time vol'
    case '1w':
      return 'Vol (24h)'
    default:
      return 'Vol (24h)'
  }
}
