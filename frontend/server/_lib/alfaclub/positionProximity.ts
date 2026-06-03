/** Pure helpers for liquidation distance and target-gain progress. */

export type PositionSide = 'long' | 'short'

export function estimateMarkPrice(params: {
  entryPx: number | null
  positionValueUsd: number | null
  unrealizedPnlUsd: number | null
  side: PositionSide | null
}): number | null {
  const { entryPx, positionValueUsd, unrealizedPnlUsd, side } = params
  if (entryPx == null || entryPx <= 0) return null
  if (positionValueUsd == null || positionValueUsd <= 0) return null
  if (unrealizedPnlUsd == null || side == null) return null

  const sizeCoins = positionValueUsd / entryPx
  if (!Number.isFinite(sizeCoins) || sizeCoins <= 0) return null

  const mark =
    side === 'long'
      ? entryPx + unrealizedPnlUsd / sizeCoins
      : entryPx - unrealizedPnlUsd / sizeCoins

  return Number.isFinite(mark) && mark > 0 ? mark : null
}

/** Percent distance from current mark to liquidation (lower = closer to liq). */
export function computeLiquidationProximityPct(params: {
  markPrice: number
  liquidationPrice: number
  side: PositionSide
}): number | null {
  const { markPrice, liquidationPrice, side } = params
  if (!Number.isFinite(markPrice) || markPrice <= 0) return null
  if (!Number.isFinite(liquidationPrice) || liquidationPrice <= 0) return null

  if (side === 'long') {
    if (liquidationPrice >= markPrice) return 0
    return ((markPrice - liquidationPrice) / markPrice) * 100
  }
  if (liquidationPrice <= markPrice) return 0
  return ((liquidationPrice - markPrice) / markPrice) * 100
}

/** Progress toward a positive PnL target (0–100+). */
export function computeTargetProgressPct(currentPnlUsd: number, targetPnlUsd: number): number | null {
  if (!Number.isFinite(targetPnlUsd) || targetPnlUsd <= 0) return null
  if (!Number.isFinite(currentPnlUsd)) return null
  if (currentPnlUsd <= 0) return 0
  return (currentPnlUsd / targetPnlUsd) * 100
}

export function formatPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '?'
  return `${value.toFixed(digits)}%`
}
