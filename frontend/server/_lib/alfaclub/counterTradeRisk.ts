import type {
  CounterTradeRiskProfile,
  CounterTradeStrategyKey,
} from './counterTradeConfig.js'

type SleeveRiskState = {
  dayKey: string
  dayStartEquityUsd: number
  peakEquityUsd: number
}

type RiskGateReason =
  | 'equity_unavailable'
  | 'daily_loss_cap_reached'
  | 'drawdown_pause'
  | 'invalid_stop_distance'

export type CounterTradeRiskGateResult =
  | {
      ok: true
      sizedNotionalUsd: number
      riskPerTradeUsd: number
      dailyLossUsd: number
      drawdownPct: number
      stopDistancePct: number
    }
  | {
      ok: false
      reason: RiskGateReason
      dailyLossUsd: number
      drawdownPct: number
      stopDistancePct: number
    }

const sleeveRiskStateByKey = new Map<string, SleeveRiskState>()

function resolveUtcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function buildSleeveKey(params: {
  roomId: string
  senderAddress: string
  strategy: CounterTradeStrategyKey
}): string {
  return `${params.roomId.toLowerCase()}:${params.senderAddress.toLowerCase()}:${params.strategy}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveOrInitSleeveState(params: {
  roomId: string
  senderAddress: string
  strategy: CounterTradeStrategyKey
  equityUsd: number
  nowMs: number
}): SleeveRiskState {
  const sleeveKey = buildSleeveKey(params)
  const dayKey = resolveUtcDayKey(params.nowMs)
  const existing = sleeveRiskStateByKey.get(sleeveKey)
  if (!existing || existing.dayKey !== dayKey) {
    const initialized = {
      dayKey,
      dayStartEquityUsd: params.equityUsd,
      peakEquityUsd: params.equityUsd,
    }
    sleeveRiskStateByKey.set(sleeveKey, initialized)
    return initialized
  }
  existing.peakEquityUsd = Math.max(existing.peakEquityUsd, params.equityUsd)
  return existing
}

export function evaluateCounterTradeRiskGate(params: {
  roomId: string
  senderAddress: string
  strategy: CounterTradeStrategyKey
  equityUsd: number | null
  requestedNotionalUsd: number
  riskProfile: CounterTradeRiskProfile
  nowMs?: number
}): CounterTradeRiskGateResult {
  const nowMs = params.nowMs ?? Date.now()
  if (params.equityUsd == null || !Number.isFinite(params.equityUsd) || params.equityUsd <= 0) {
    return {
      ok: false,
      reason: 'equity_unavailable',
      dailyLossUsd: 0,
      drawdownPct: 0,
      stopDistancePct: 0,
    }
  }

  const stopDistancePct = params.riskProfile.stopDistancePctByStrategy[params.strategy]
  if (!Number.isFinite(stopDistancePct) || stopDistancePct <= 0) {
    return {
      ok: false,
      reason: 'invalid_stop_distance',
      dailyLossUsd: 0,
      drawdownPct: 0,
      stopDistancePct: 0,
    }
  }

  const sleeve = resolveOrInitSleeveState({
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    strategy: params.strategy,
    equityUsd: params.equityUsd,
    nowMs,
  })

  const dailyLossUsd = Math.max(0, sleeve.dayStartEquityUsd - params.equityUsd)
  const drawdownPct =
    sleeve.peakEquityUsd > 0
      ? ((sleeve.peakEquityUsd - params.equityUsd) / sleeve.peakEquityUsd) * 100
      : 0
  const dailyLossCapUsd = params.equityUsd * (params.riskProfile.dailyLossCapBps / 10_000)
  const maxDrawdownPausePct = params.riskProfile.maxDrawdownPauseBps / 100

  if (dailyLossUsd >= dailyLossCapUsd) {
    return {
      ok: false,
      reason: 'daily_loss_cap_reached',
      dailyLossUsd,
      drawdownPct,
      stopDistancePct,
    }
  }
  if (drawdownPct >= maxDrawdownPausePct) {
    return {
      ok: false,
      reason: 'drawdown_pause',
      dailyLossUsd,
      drawdownPct,
      stopDistancePct,
    }
  }

  const riskPerTradeUsd = params.equityUsd * (params.riskProfile.riskPerTradeBps / 10_000)
  const sizedFromStopDistance = riskPerTradeUsd / (stopDistancePct / 100)
  const sizedNotionalUsd = clamp(
    Math.min(params.requestedNotionalUsd, sizedFromStopDistance),
    0,
    Number.MAX_SAFE_INTEGER,
  )

  return {
    ok: true,
    sizedNotionalUsd,
    riskPerTradeUsd,
    dailyLossUsd,
    drawdownPct,
    stopDistancePct,
  }
}

export function __resetCounterTradeRiskStateForTests(): void {
  sleeveRiskStateByKey.clear()
}
