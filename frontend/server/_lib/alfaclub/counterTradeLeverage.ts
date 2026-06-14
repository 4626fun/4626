import type { HyperliquidClearinghouseState } from './hyperliquid.js'

export function findCoinLeverageFromState(
  state: HyperliquidClearinghouseState | null,
  coin: string | null | undefined,
): number | null {
  const target = String(coin ?? '').trim().toUpperCase()
  if (!target) return null
  for (const leg of state?.assetPositions ?? []) {
    if (String(leg.coin ?? '').trim().toUpperCase() !== target) continue
    if (leg.leverage == null || !Number.isFinite(leg.leverage) || leg.leverage <= 0) continue
    return leg.leverage
  }
  return null
}
