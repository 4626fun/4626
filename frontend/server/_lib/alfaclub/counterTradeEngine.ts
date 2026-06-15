import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'
import {
  deriveCounterSide,
  isFavoredDirection,
  type CounterTradeBias,
  type CounterTradePreset,
  type CounterTradeRuntimeConfig,
  type CounterTradeSide,
  type CounterTradeStrategyKey,
} from './counterTradeConfig.js'

export type CounterTradeDecision =
  | {
      ok: true
      reason: 'execute'
      fillAction: CounterTradeFillAction
      counterSide: CounterTradeSide
      counterLeverage: number
      counterNotionalUsd: number
      favoredDirection: boolean
    }
  | {
      ok: false
      reason:
        | 'missing_side'
        | 'missing_notional'
        | 'below_min_notional'
        | 'below_min_leverage'
        | 'risk_liquidation_too_close'
        | 'fill_action_not_counterable'
        | 'invalid_input'
      fillAction: CounterTradeFillAction | null
    }

export type CounterTradeFillAction =
  | 'entry'
  | 'add'
  | 'reduce'
  | 'close'
  | 'liquidated'
  | 'unknown'

type PresetCaps = {
  leverageCapMultiplier: number
  notionalCapMultiplier: number
  hourlyActionMultiplier: number
}

const PRESET_CAPS: Record<CounterTradePreset, PresetCaps> = {
  defensive: {
    leverageCapMultiplier: 0.8,
    notionalCapMultiplier: 0.7,
    hourlyActionMultiplier: 0.5,
  },
  balanced: {
    leverageCapMultiplier: 1,
    notionalCapMultiplier: 1,
    hourlyActionMultiplier: 1,
  },
  aggressive: {
    leverageCapMultiplier: 1.15,
    notionalCapMultiplier: 1.2,
    hourlyActionMultiplier: 1.2,
  },
}

const PRESET_STRATEGY_MAP: Record<CounterTradePreset, CounterTradeStrategyKey> = {
  defensive: 'meanRevert',
  balanced: 'trend',
  aggressive: 'event',
}

function parseLeverageFromDir(dir: string | null): number | null {
  const raw = String(dir ?? '')
  const match = raw.match(/(\d+(?:\.\d+)?)\s*x/i)
  if (!match?.[1]) return null
  const leverage = Number(match[1])
  return Number.isFinite(leverage) && leverage > 0 ? leverage : null
}

function parseFillSide(fill: HyperliquidUserFillDetailed): CounterTradeSide | null {
  const dir = String(fill.dir ?? '').toLowerCase()
  if (!dir) return null
  if (dir.includes('close') || dir.includes('liquidat') || dir.includes('liq')) {
    if (dir.includes('short')) return 'long'
    if (dir.includes('long')) return 'short'
    if (fill.side === 'long') return 'short'
    if (fill.side === 'short') return 'long'
  }
  if (dir.includes('long') || dir.includes('buy')) return 'long'
  if (dir.includes('short') || dir.includes('sell')) return 'short'
  if (fill.side === 'long' || fill.side === 'short') return fill.side
  return null
}

function computeUserNotionalUsd(fill: HyperliquidUserFillDetailed): number | null {
  if (fill.px == null || fill.sz == null) return null
  const notional = Math.abs(fill.px * fill.sz)
  return Number.isFinite(notional) && notional > 0 ? notional : null
}

export function classifyCounterTradeFillAction(fill: HyperliquidUserFillDetailed): CounterTradeFillAction {
  const dir = (fill.dir ?? '').toLowerCase()
  if (dir.includes('liquidat') || dir.includes('liq')) return 'liquidated'

  const sizeRaw = Number(fill.sz ?? 0)
  const size = Math.abs(sizeRaw)
  const EPSILON = 1e-9
  const inferredSide = parseFillSide(fill)
  const beforeRaw = fill.startPosition == null ? null : Number(fill.startPosition)

  // Primary classification path: use signed position transition when available.
  // This distinguishes partial reduce vs full close even when dir text says "Close".
  if (Number.isFinite(size) && size > 0 && beforeRaw != null && Number.isFinite(beforeRaw) && inferredSide != null) {
    const before = beforeRaw
    const signedDelta = inferredSide === 'long' ? size : -size
    const after = before + signedDelta
    const beforeAbs = Math.abs(before)
    const afterAbs = Math.abs(after)

    if (beforeAbs <= EPSILON && afterAbs > EPSILON) return 'entry'
    if (beforeAbs > EPSILON && afterAbs <= EPSILON) return 'close'
    // Conservative handling: if a single fill appears to cross through zero,
    // treat it as a close-like transition instead of inventing a synthetic "flip".
    // This avoids countering ambiguous close+reopen transitions as one action.
    if (before * after < -EPSILON && beforeAbs > EPSILON && afterAbs > EPSILON) return 'close'
    if (afterAbs > beforeAbs) return 'add'
    if (afterAbs < beforeAbs) return 'reduce'
  }

  // Fallback path: rely on exchange dir hints only when transition math is unavailable.
  if (dir.includes('open')) return 'entry'
  // "close" can also appear on partial reductions; without position math we fail closed.
  if (dir.includes('close')) return 'unknown'

  if (!Number.isFinite(size) || size <= 0) return 'unknown'
  return 'unknown'
}

/**
 * Fill actions that mean the countered user exited risk on a pair. The bot
 * mirrors these by closing its own position on the same pair (full close —
 * the arena CLI has no partial-close, so `reduce` fills are intentionally
 * not mirrored).
 */
export function isExitFillAction(action: CounterTradeFillAction): boolean {
  return action === 'close' || action === 'liquidated'
}

export type CounterPositionLeg = {
  coin: string
  side: CounterTradeSide
  positionValue: number
}

/**
 * Find the bot's open position leg for a coin, if any. Used to decide
 * whether a mirrored exit has anything to close.
 */
export function findCounterPositionForCoin(
  state: HyperliquidClearinghouseState | null,
  coin: string | null | undefined,
): CounterPositionLeg | null {
  const target = String(coin ?? '').trim().toUpperCase()
  if (!target) return null
  for (const leg of state?.assetPositions ?? []) {
    if (String(leg.coin ?? '').trim().toUpperCase() !== target) continue
    if (leg.side !== 'long' && leg.side !== 'short') continue
    if (leg.positionValue == null || !Number.isFinite(leg.positionValue) || leg.positionValue <= 0) continue
    return { coin: leg.coin, side: leg.side, positionValue: leg.positionValue }
  }
  return null
}

export type CounterWalletPositionLeg = NonNullable<
  HyperliquidClearinghouseState['assetPositions']
>[number]

/**
 * Approximate distance (in % of mark price) between a leg's mark and its
 * liquidation price. Mark is approximated from entry + unrealized PnL since
 * the clearinghouse snapshot does not carry mark directly.
 */
export function computeLegLiqDistancePct(leg: CounterWalletPositionLeg): number | null {
  if (leg.side == null || leg.liquidationPx == null || leg.entryPx == null || leg.positionValue == null) return null
  if (leg.positionValue <= 0) return null

  // Approximate mark from entry + unrealized pnl.
  const markApprox =
    leg.entryPx +
    (leg.side === 'long'
      ? (leg.unrealizedPnl ?? 0) / Math.max(1e-9, leg.positionValue / Math.max(1e-9, leg.entryPx))
      : -(leg.unrealizedPnl ?? 0) / Math.max(1e-9, leg.positionValue / Math.max(1e-9, leg.entryPx)))

  if (!Number.isFinite(markApprox) || markApprox <= 0) return null
  const distance =
    leg.side === 'long'
      ? ((markApprox - leg.liquidationPx) / markApprox) * 100
      : ((leg.liquidationPx - markApprox) / markApprox) * 100
  return Number.isFinite(distance) ? distance : null
}

function computeMinimumLiqDistancePct(state: HyperliquidClearinghouseState | null): number | null {
  let minDistance: number | null = null
  for (const leg of state?.assetPositions ?? []) {
    const distance = computeLegLiqDistancePct(leg)
    if (distance == null) continue
    if (minDistance == null || distance < minDistance) minDistance = distance
  }
  return minDistance
}

function toQuarter(value: number): number {
  return Math.floor(value * 4) / 4
}

export function deriveEventKeyFromFill(params: {
  walletAddress: string
  fill: HyperliquidUserFillDetailed
}): string {
  const parts = [
    params.walletAddress.toLowerCase(),
    String(params.fill.time),
    String(params.fill.coin ?? ''),
    String(params.fill.px ?? ''),
    String(params.fill.sz ?? ''),
    String(params.fill.dir ?? ''),
    String(params.fill.startPosition ?? ''),
  ]
  return parts.join('|')
}

export function deriveCounterTradeDecision(params: {
  bias: CounterTradeBias
  preset: CounterTradePreset
  fill: HyperliquidUserFillDetailed
  userNotionalUsd: number | null
  userLeverage: number | null
  runtime: CounterTradeRuntimeConfig
  counterWalletState: HyperliquidClearinghouseState | null
  strictInverseParity?: boolean
}): CounterTradeDecision {
  const fillAction = classifyCounterTradeFillAction(params.fill)
  if (fillAction === 'reduce' || fillAction === 'close' || fillAction === 'liquidated') {
    return { ok: false, reason: 'fill_action_not_counterable', fillAction }
  }
  const userSide = parseFillSide(params.fill)
  if (!userSide) return { ok: false, reason: 'missing_side', fillAction }
  if (!params.userNotionalUsd || params.userNotionalUsd <= 0) {
    return { ok: false, reason: 'missing_notional', fillAction }
  }
  if (params.userNotionalUsd < params.runtime.minUserNotionalUsd) {
    return { ok: false, reason: 'below_min_notional', fillAction }
  }

  const minLiqDistance = computeMinimumLiqDistancePct(params.counterWalletState)
  if (minLiqDistance != null && minLiqDistance <= params.runtime.liquidationMinDistancePct) {
    return { ok: false, reason: 'risk_liquidation_too_close', fillAction }
  }

  const presetCaps = PRESET_CAPS[params.preset]
  const favoredDirection = isFavoredDirection({ bias: params.bias, userSide })
  const counterSide = deriveCounterSide(userSide)
  const strictInverseParity = params.strictInverseParity === true

  const leverageMultiplier =
    strictInverseParity
      ? 1
      : params.bias === 'neutral'
      ? params.runtime.neutralMultiplier
      : favoredDirection
        ? params.runtime.favoredMultiplier
        : params.runtime.unfavoredMultiplier

  const notionalRatio =
    strictInverseParity
      ? 1
      : params.bias === 'neutral'
      ? params.runtime.neutralNotionalRatio
      : favoredDirection
        ? params.runtime.favoredNotionalRatio
        : params.runtime.unfavoredNotionalRatio

  const userLeverage = params.userLeverage ?? parseLeverageFromDir(params.fill.dir) ?? 1
  const candidateLeverage = userLeverage * leverageMultiplier

  const biasLeverageCap =
    strictInverseParity
      ? params.runtime.globalMaxLeverage
      : params.bias === 'neutral'
      ? params.runtime.neutralBiasLeverageCap
      : favoredDirection
        ? params.runtime.favoredBiasLeverageCap
        : params.runtime.unfavoredBiasLeverageCap

  const cappedLeverage = Math.min(
    candidateLeverage,
    params.runtime.globalMaxLeverage,
    biasLeverageCap,
    strictInverseParity
      ? params.runtime.globalMaxLeverage
      : params.runtime.globalMaxLeverage * presetCaps.leverageCapMultiplier,
  )
  const counterLeverage = toQuarter(cappedLeverage)
  if (!Number.isFinite(counterLeverage) || counterLeverage <= 0.25) {
    return { ok: false, reason: 'below_min_leverage', fillAction }
  }

  const rawCounterNotional = params.userNotionalUsd * notionalRatio
  const counterNotionalUsd = Math.min(
    rawCounterNotional,
    strictInverseParity
      ? params.runtime.maxCounterNotionalPerTradeUsd
      : params.runtime.maxCounterNotionalPerTradeUsd * presetCaps.notionalCapMultiplier,
  )
  if (!Number.isFinite(counterNotionalUsd) || counterNotionalUsd <= 0) {
    return { ok: false, reason: 'invalid_input', fillAction }
  }

  return {
    ok: true,
    reason: 'execute',
    fillAction,
    counterSide,
    counterLeverage,
    counterNotionalUsd,
    favoredDirection,
  }
}

export function derivePresetHourlyCap(params: {
  preset: CounterTradePreset
  runtime: CounterTradeRuntimeConfig
}): number {
  const multiplier = PRESET_CAPS[params.preset].hourlyActionMultiplier
  return Math.max(1, Math.floor(params.runtime.hourlyActionCap * multiplier))
}

export function derivePresetDailyNotionalCap(params: {
  preset: CounterTradePreset
  runtime: CounterTradeRuntimeConfig
}): number {
  const multiplier = PRESET_CAPS[params.preset].notionalCapMultiplier
  return Math.max(1, params.runtime.dailyNotionalCapUsd * multiplier)
}

export function resolveCounterTradeStrategyForPreset(
  preset: CounterTradePreset,
): CounterTradeStrategyKey {
  return PRESET_STRATEGY_MAP[preset]
}

export function deriveUserLeverage(fill: HyperliquidUserFillDetailed): number | null {
  return parseLeverageFromDir(fill.dir)
}

export function deriveUserSide(fill: HyperliquidUserFillDetailed): CounterTradeSide | null {
  return parseFillSide(fill)
}

export function deriveUserNotional(fill: HyperliquidUserFillDetailed): number | null {
  return computeUserNotionalUsd(fill)
}

