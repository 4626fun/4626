export interface LegState {
  margin: number
  buffer: number
  notional: number
  health: number
  entryPrice: number
  currentPrice: number
  isLong: boolean
  usedBuffer?: number
}

export interface BufferAction {
  type: 'ADD' | 'TRIM'
  amount: number
  reason: string
  newHealth: number
  newBuffer: number
}

export interface BufferConfig {
  earlyThreshold: number
  balancedThreshold: number
  optimalThreshold: number
  criticalThreshold: number
  baseUtilizationTarget: number
  maxSingleAddPct: number
  minAddAmount: number
  volatilityMultiplier: number
}

export interface EfficiencyPoint {
  drawdownPct: number
  marginalEfficiency: number
  health: number
  recommendedAdd: number
  efficiencyScore: number
}

export const DEFAULT_BUFFER_CONFIG: BufferConfig = {
  earlyThreshold: 0.88,
  balancedThreshold: 0.78,
  optimalThreshold: 0.62,
  criticalThreshold: 0.48,
  baseUtilizationTarget: 0.65,
  maxSingleAddPct: 0.35,
  minAddAmount: 80,
  volatilityMultiplier: 1.0,
}

export function generateEfficiencyCurve(
  initialMargin: number = 1000,
  leverage: number = 20,
  steps: number = 60,
): EfficiencyPoint[] {
  const safeMargin = Math.max(1, initialMargin)
  const safeLeverage = Math.max(1, leverage)
  const safeSteps = Math.max(1, Math.floor(steps))
  const notional = safeMargin * safeLeverage
  const data: EfficiencyPoint[] = []

  for (let i = 0; i <= safeSteps; i += 1) {
    const drawdownPct = (i / safeSteps) * 5.0
    const approxHealth = Math.max(0.08, 1 - (drawdownPct / 100) * safeLeverage * 0.82)

    const marginalEfficiency = (100 / notional) * (1 / approxHealth) * 100

    const efficiencyScore = marginalEfficiency * (1.2 - drawdownPct * 0.08)

    let recommendedAdd = 80
    if (approxHealth < 0.5) recommendedAdd = 350
    else if (approxHealth < 0.62) recommendedAdd = 280
    else if (approxHealth < 0.78) recommendedAdd = 200
    else if (approxHealth < 0.88) recommendedAdd = 120

    data.push({
      drawdownPct: Number(drawdownPct.toFixed(2)),
      marginalEfficiency: Number(marginalEfficiency.toFixed(3)),
      health: Number(approxHealth.toFixed(3)),
      recommendedAdd: Math.floor(recommendedAdd),
      efficiencyScore: Number(efficiencyScore.toFixed(2)),
    })
  }
  return data
}

export function calculateOptimalBufferAction(
  leg: LegState,
  config: BufferConfig = DEFAULT_BUFFER_CONFIG,
  volatilityFactor: number = 1.0,
): BufferAction | null {
  if (leg.entryPrice <= 0 || leg.currentPrice <= 0 || leg.margin <= 0 || leg.notional <= 0) {
    return null
  }

  const adversePct = leg.isLong
    ? (leg.entryPrice - leg.currentPrice) / leg.entryPrice
    : (leg.currentPrice - leg.entryPrice) / leg.entryPrice

  const health = leg.health
  const remainingBuffer = Math.max(0, leg.buffer)
  const usedBufferPct = leg.usedBuffer ? leg.usedBuffer / Math.max(1, leg.buffer) : 0
  const effectiveVolatility = Math.max(0.1, volatilityFactor * config.volatilityMultiplier)

  if (adversePct > 0) {
    let addAmount = 0
    let reason = ''

    if (health < config.criticalThreshold && remainingBuffer > config.minAddAmount) {
      addAmount = Math.min(remainingBuffer * config.maxSingleAddPct * 1.15, 450 * effectiveVolatility)
      reason = 'Critical - Peak efficiency'
    } else if (
      health < config.optimalThreshold &&
      remainingBuffer > 140 &&
      usedBufferPct < config.baseUtilizationTarget * 1.15
    ) {
      addAmount = Math.min(remainingBuffer * 0.33, 290 * effectiveVolatility)
      reason = 'Optimal high-efficiency zone'
    } else if (
      health < config.balancedThreshold &&
      remainingBuffer > 170 &&
      usedBufferPct < config.baseUtilizationTarget
    ) {
      addAmount = Math.min(remainingBuffer * 0.26, 220)
      reason = 'Balanced defense'
    } else if (
      health < config.earlyThreshold &&
      remainingBuffer > 90 &&
      usedBufferPct < config.baseUtilizationTarget * 0.55
    ) {
      addAmount = Math.min(remainingBuffer * 0.15, 130)
      reason = 'Early prevention'
    }

    if (addAmount >= config.minAddAmount) {
      const healthGain = (addAmount / leg.margin) * 0.78
      const flooredAmount = Math.floor(addAmount)
      return {
        type: 'ADD',
        amount: flooredAmount,
        reason: `${reason} (vol: ${effectiveVolatility.toFixed(1)})`,
        newHealth: Math.min(1.95, health + healthGain),
        newBuffer: Math.max(0, remainingBuffer - flooredAmount),
      }
    }
  } else if (adversePct < -0.008) {
    const profit = Math.abs(adversePct) * leg.notional
    if (profit > 180 && health > 1.18) {
      const trimAmount = Math.min(profit * 0.42, leg.margin * 0.28)
      const flooredAmount = Math.floor(trimAmount)
      return {
        type: 'TRIM',
        amount: flooredAmount,
        reason: 'Profit take → buffer rebuild',
        newHealth: Math.max(0.9, health - (trimAmount / leg.margin) * 0.6),
        newBuffer: remainingBuffer + flooredAmount,
      }
    }
  }

  return null
}
