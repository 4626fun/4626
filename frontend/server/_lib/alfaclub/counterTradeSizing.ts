import type { CounterTradePreset, CounterTradeRuntimeConfig, CounterTradeSide } from './counterTradeConfig.js'
import type { CounterWalletPositionLeg } from './counterTradeEngine.js'
import { computeLegMarkApprox } from './counterTradeEngine.js'

const PRESET_NOTIONAL_CAP_MULTIPLIER: Record<CounterTradePreset, number> = {
  defensive: 0.75,
  balanced: 1,
  aggressive: 1.25,
}

export function resolveEffectiveSizeCapPct(runtime: CounterTradeRuntimeConfig): number {
  return Math.min(runtime.maxCounterNotionalPctOfFund, runtime.maxCounterNotionalCeilingPctOfFund)
}

/** Max USD notional for one bot response from fund % caps. */
export function resolveMaxCounterNotionalUsd(params: {
  runtime: CounterTradeRuntimeConfig
  accountValueUsd: number | null | undefined
  preset?: CounterTradePreset
  strictInverseParity?: boolean
}): number {
  const multiplier =
    params.strictInverseParity || !params.preset
      ? 1
      : PRESET_NOTIONAL_CAP_MULTIPLIER[params.preset]

  const fund = params.accountValueUsd
  if (fund == null || !Number.isFinite(fund) || fund <= 0) return 0

  const effectivePct = resolveEffectiveSizeCapPct(params.runtime) * multiplier
  if (!Number.isFinite(effectivePct) || effectivePct <= 0) return 0

  return fund * (effectivePct / 100)
}

/** Side-aware adverse move from average entry to mark, as a positive %. */
export function computeAdverseDrawdownPct(params: {
  side: CounterTradeSide
  entryPx: number
  markPx: number
}): number | null {
  const { side, entryPx, markPx } = params
  if (!Number.isFinite(entryPx) || entryPx <= 0) return null
  if (!Number.isFinite(markPx) || markPx <= 0) return null

  const raw =
    side === 'long'
      ? ((entryPx - markPx) / entryPx) * 100
      : ((markPx - entryPx) / entryPx) * 100
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw
}

/** Tunable curve multiplier in [0, 1]: clamp(drawdown/D, 0, 1)^alpha. */
export function resolveDrawdownCurveMultiplier(params: {
  adverseDrawdownPct: number
  maxDrawdownForFullSizePct: number
  alpha: number
}): number | null {
  const { adverseDrawdownPct, maxDrawdownForFullSizePct, alpha } = params
  if (
    !Number.isFinite(adverseDrawdownPct) ||
    adverseDrawdownPct < 0 ||
    !Number.isFinite(maxDrawdownForFullSizePct) ||
    maxDrawdownForFullSizePct <= 0 ||
    !Number.isFinite(alpha) ||
    alpha <= 0
  ) {
    return null
  }

  const normalized = Math.min(1, adverseDrawdownPct / maxDrawdownForFullSizePct)
  return normalized ** alpha
}

/**
 * Drawdown-based dip add: fund * min(hardCapPct, targetPct * curve).
 * Returns null when inputs are missing or curve is zero.
 */
export function resolveDrawdownBasedDipAddUsd(params: {
  runtime: CounterTradeRuntimeConfig
  accountValueUsd: number | null | undefined
  leg: CounterWalletPositionLeg
}): number | null {
  const fund = params.accountValueUsd
  if (fund == null || !Number.isFinite(fund) || fund <= 0) return null
  if (params.leg.side !== 'long' && params.leg.side !== 'short') return null
  if (params.leg.entryPx == null || !Number.isFinite(params.leg.entryPx) || params.leg.entryPx <= 0) {
    return null
  }

  const markPx = computeLegMarkApprox(params.leg)
  if (markPx == null) return null

  const adverseDrawdownPct = computeAdverseDrawdownPct({
    side: params.leg.side,
    entryPx: params.leg.entryPx,
    markPx,
  })
  if (adverseDrawdownPct == null) return null

  const curve = resolveDrawdownCurveMultiplier({
    adverseDrawdownPct,
    maxDrawdownForFullSizePct: params.runtime.dipDrawdownFullSizePct,
    alpha: params.runtime.dipDrawdownCurveAlpha,
  })
  if (curve == null || curve <= 0) return null

  const allocationPct = Math.min(
    params.runtime.maxCounterNotionalPctOfFund * curve,
    params.runtime.maxCounterNotionalCeilingPctOfFund,
  )
  if (!Number.isFinite(allocationPct) || allocationPct <= 0) return null

  return fund * (allocationPct / 100)
}

export function formatSizeCapForMembers(runtime: CounterTradeRuntimeConfig): string {
  const effective = resolveEffectiveSizeCapPct(runtime)
  const curveNote = `drawdown curve (full at **${runtime.dipDrawdownFullSizePct}%** adverse move)`
  if (runtime.maxCounterNotionalCeilingPctOfFund > runtime.maxCounterNotionalPctOfFund) {
    return `**${effective}%** of the trading fund per dip response, ${curveNote} (hard max **${runtime.maxCounterNotionalCeilingPctOfFund}%**)`
  }
  return `**${effective}%** of the trading fund per dip response, ${curveNote}`
}
