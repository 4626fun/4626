import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'
import {
  deriveCounterSide,
  isFavoredDirection,
  type CounterTradeBias,
  type CounterTradePreset,
  type CounterTradeRuntimeConfig,
  type CounterTradeSide,
} from './counterTradeConfig.js'

export type CounterTradeDecision =
  | {
      ok: true
      reason: 'execute'
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
        | 'invalid_input'
    }

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

function parseLeverageFromDir(dir: string | null): number | null {
  const raw = String(dir ?? '')
  const match = raw.match(/(\d+(?:\.\d+)?)\s*x/i)
  if (!match?.[1]) return null
  const leverage = Number(match[1])
  return Number.isFinite(leverage) && leverage > 0 ? leverage : null
}

function parseFillSide(fill: HyperliquidUserFillDetailed): CounterTradeSide | null {
  if (fill.side === 'long' || fill.side === 'short') return fill.side
  const dir = String(fill.dir ?? '').toLowerCase()
  if (!dir) return null
  if (dir.includes('long') || dir.includes('buy')) return 'long'
  if (dir.includes('short') || dir.includes('sell')) return 'short'
  return null
}

function computeUserNotionalUsd(fill: HyperliquidUserFillDetailed): number | null {
  if (fill.px == null || fill.sz == null) return null
  const notional = Math.abs(fill.px * fill.sz)
  return Number.isFinite(notional) && notional > 0 ? notional : null
}

function computeMinimumLiqDistancePct(state: HyperliquidClearinghouseState | null): number | null {
  const legs = state?.assetPositions ?? []
  let minDistance: number | null = null

  for (const leg of legs) {
    if (leg.side == null || leg.liquidationPx == null || leg.entryPx == null || leg.positionValue == null) continue
    if (leg.positionValue <= 0) continue

    // Approximate mark from entry + unrealized pnl.
    const markApprox =
      leg.entryPx +
      (leg.side === 'long'
        ? (leg.unrealizedPnl ?? 0) / Math.max(1e-9, leg.positionValue / Math.max(1e-9, leg.entryPx))
        : -(leg.unrealizedPnl ?? 0) / Math.max(1e-9, leg.positionValue / Math.max(1e-9, leg.entryPx)))

    if (!Number.isFinite(markApprox) || markApprox <= 0) continue
    const distance =
      leg.side === 'long'
        ? ((markApprox - leg.liquidationPx) / markApprox) * 100
        : ((leg.liquidationPx - markApprox) / markApprox) * 100
    if (!Number.isFinite(distance)) continue
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
}): CounterTradeDecision {
  const userSide = parseFillSide(params.fill)
  if (!userSide) return { ok: false, reason: 'missing_side' }
  if (!params.userNotionalUsd || params.userNotionalUsd <= 0) return { ok: false, reason: 'missing_notional' }
  if (params.userNotionalUsd < params.runtime.minUserNotionalUsd) {
    return { ok: false, reason: 'below_min_notional' }
  }

  const minLiqDistance = computeMinimumLiqDistancePct(params.counterWalletState)
  if (minLiqDistance != null && minLiqDistance <= params.runtime.liquidationMinDistancePct) {
    return { ok: false, reason: 'risk_liquidation_too_close' }
  }

  const presetCaps = PRESET_CAPS[params.preset]
  const favoredDirection = isFavoredDirection({ bias: params.bias, userSide })
  const counterSide = deriveCounterSide(userSide)

  const leverageMultiplier =
    params.bias === 'neutral'
      ? params.runtime.neutralMultiplier
      : favoredDirection
        ? params.runtime.favoredMultiplier
        : params.runtime.unfavoredMultiplier

  const notionalRatio =
    params.bias === 'neutral'
      ? params.runtime.neutralNotionalRatio
      : favoredDirection
        ? params.runtime.favoredNotionalRatio
        : params.runtime.unfavoredNotionalRatio

  const userLeverage = params.userLeverage ?? parseLeverageFromDir(params.fill.dir) ?? 1
  const candidateLeverage = userLeverage * leverageMultiplier

  const biasLeverageCap =
    params.bias === 'neutral'
      ? params.runtime.neutralBiasLeverageCap
      : favoredDirection
        ? params.runtime.favoredBiasLeverageCap
        : params.runtime.unfavoredBiasLeverageCap

  const cappedLeverage = Math.min(
    candidateLeverage,
    params.runtime.globalMaxLeverage,
    biasLeverageCap,
    params.runtime.globalMaxLeverage * presetCaps.leverageCapMultiplier,
  )
  const counterLeverage = toQuarter(cappedLeverage)
  if (!Number.isFinite(counterLeverage) || counterLeverage <= 0.25) {
    return { ok: false, reason: 'below_min_leverage' }
  }

  const rawCounterNotional = params.userNotionalUsd * notionalRatio
  const counterNotionalUsd = Math.min(
    rawCounterNotional,
    params.runtime.maxCounterNotionalPerTradeUsd * presetCaps.notionalCapMultiplier,
  )
  if (!Number.isFinite(counterNotionalUsd) || counterNotionalUsd <= 0) {
    return { ok: false, reason: 'invalid_input' }
  }

  return {
    ok: true,
    reason: 'execute',
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

export function deriveUserLeverage(fill: HyperliquidUserFillDetailed): number | null {
  return parseLeverageFromDir(fill.dir)
}

export function deriveUserSide(fill: HyperliquidUserFillDetailed): CounterTradeSide | null {
  return parseFillSide(fill)
}

export function deriveUserNotional(fill: HyperliquidUserFillDetailed): number | null {
  return computeUserNotionalUsd(fill)
}

