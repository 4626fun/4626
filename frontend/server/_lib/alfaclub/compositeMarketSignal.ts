import type {
  FundingOiRegimeResult,
  FundingOiSignalLean,
} from './fundingOiRegime.js'

export type CounterTradeLeg = {
  signal: 'long-bias' | 'short-bias' | 'neutral'
  conviction: number
  priceChangePct?: number | null
  realizedPnl?: number | null
  rebalanceCount?: number | null
  resolvedInterval?: string | null
  recommendedLeveragePercent?: number | null
}

export type CompositeAction = 'LONG' | 'SHORT' | 'STAY_OUT' | 'NO_DATA'
export type CompositeAgreement = 'aligned' | 'partial' | 'conflict' | 'single-source' | 'none'

export type CompositeMarketSignal = {
  symbol: string
  action: CompositeAction
  /** Conviction in the composite action (for STAY_OUT: certainty you should not force a trade). */
  conviction: number
  /** Recommended leverage percent of market max; 0 when STAY_OUT / NO_DATA. */
  sizeHintPct: number
  agreement: CompositeAgreement
  fundingOi: FundingOiRegimeResult | null
  counter: CounterTradeLeg | null
  reasons: string[]
  playbook: string[]
  shadowOnly: true
}

type Direction = 'long' | 'short' | 'neutral'

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function fundingDirection(lean: FundingOiSignalLean): Direction {
  switch (lean) {
    case 'fade-longs':
    case 'watch-longs':
      return 'short'
    case 'fade-shorts':
    case 'watch-shorts':
      return 'long'
    case 'insufficient-data':
    case 'no-edge':
    default:
      return 'neutral'
  }
}

function fundingWeight(result: FundingOiRegimeResult): number {
  const lean = result.lean
  if (lean === 'insufficient-data') return 0
  if (lean === 'no-edge') return 0
  if (lean === 'fade-longs' || lean === 'fade-shorts') {
    return clampScore(result.edgeScore)
  }
  // watch-* is a soft contrarian lean — cap so it cannot dominate alone
  return clampScore(Math.min(result.edgeScore, 48))
}

function counterDirection(signal: CounterTradeLeg['signal']): Direction {
  if (signal === 'long-bias') return 'long'
  if (signal === 'short-bias') return 'short'
  return 'neutral'
}

function counterWeight(leg: CounterTradeLeg): number {
  if (leg.signal === 'neutral') return 0
  return clampScore(leg.conviction)
}

function leanLabel(lean: FundingOiSignalLean): string {
  switch (lean) {
    case 'fade-longs':
      return 'FADE LONGS'
    case 'fade-shorts':
      return 'FADE SHORTS'
    case 'watch-longs':
      return 'WATCH LONG PRESSURE'
    case 'watch-shorts':
      return 'WATCH SHORT PRESSURE'
    case 'insufficient-data':
      return 'INSUFFICIENT DATA'
    case 'no-edge':
    default:
      return 'NO EDGE'
  }
}

function actionFromDirection(direction: Direction): CompositeAction {
  if (direction === 'long') return 'LONG'
  if (direction === 'short') return 'SHORT'
  return 'STAY_OUT'
}

function sizeFromConviction(action: CompositeAction, conviction: number): number {
  if (action === 'STAY_OUT' || action === 'NO_DATA') return 0
  return clampScore(28 + conviction * 0.52)
}

/**
 * Fuse counter-trade direction (7d price path) with Funding/OI crowding into one
 * decisive advisory action. Conflict / no-edge resolve to STAY_OUT rather than a
 * mushy mid-score "maybe".
 */
export function fuseCompositeMarketSignal(params: {
  symbol: string
  fundingOi: FundingOiRegimeResult | null
  counter: CounterTradeLeg | null
}): CompositeMarketSignal {
  const symbol = params.symbol.trim().toUpperCase() || 'UNKNOWN'
  const fundingOi = params.fundingOi
  const counter = params.counter

  if (!fundingOi && !counter) {
    return {
      symbol,
      action: 'NO_DATA',
      conviction: 0,
      sizeHintPct: 0,
      agreement: 'none',
      fundingOi: null,
      counter: null,
      reasons: ['No Funding/OI context and no counter-trade path available.'],
      playbook: [
        'Retry `/signal` after market data recovers.',
        'Do not size from an empty composite.',
      ],
      shadowOnly: true,
    }
  }

  if (fundingOi?.lean === 'insufficient-data' && !counter) {
    return {
      symbol,
      action: 'NO_DATA',
      conviction: 0,
      sizeHintPct: 0,
      agreement: 'none',
      fundingOi,
      counter: null,
      reasons: fundingOi.reasons,
      playbook: fundingOi.playbook,
      shadowOnly: true,
    }
  }

  const fDir = fundingOi ? fundingDirection(fundingOi.lean) : 'neutral'
  const fW = fundingOi ? fundingWeight(fundingOi) : 0
  const cDir = counter ? counterDirection(counter.signal) : 'neutral'
  const cW = counter ? counterWeight(counter) : 0

  const fundingActive = fDir !== 'neutral' && fW > 0
  const counterActive = cDir !== 'neutral' && cW > 0

  let action: CompositeAction = 'STAY_OUT'
  let agreement: CompositeAgreement = 'none'
  let conviction = 0
  const reasons: string[] = []
  const playbook: string[] = []

  if (counterActive && fundingActive && cDir === fDir) {
    agreement = 'aligned'
    action = actionFromDirection(cDir)
    const base = 0.55 * cW + 0.45 * fW
    const bonus = Math.min(22, 0.18 * Math.min(cW, fW))
    conviction = clampScore(base + bonus)
    reasons.push(
      `Counter-trade (7d) and Funding/OI both point **${cDir.toUpperCase()}** — factors aligned.`,
    )
  } else if (counterActive && fundingActive && cDir !== fDir) {
    agreement = 'conflict'
    action = 'STAY_OUT'
    // High certainty that forcing a trade is wrong when legs disagree.
    conviction = clampScore(62 + 0.25 * Math.min(cW, fW) + 0.1 * Math.abs(cW - fW))
    reasons.push(
      `Conflict: counter-trade leans **${cDir.toUpperCase()}** while Funding/OI leans **${fDir.toUpperCase()}**.`,
    )
    reasons.push('Composite veto: do not force size when primary legs disagree.')
  } else if (counterActive && !fundingActive) {
    agreement = fundingOi ? 'partial' : 'single-source'
    action = actionFromDirection(cDir)
    // Discount single-leg signals so they cannot claim full-stack conviction.
    conviction = clampScore(cW * (fundingOi ? 0.72 : 0.68))
    reasons.push(
      fundingOi
        ? `Counter-trade drives **${cDir.toUpperCase()}**; Funding/OI is ${leanLabel(fundingOi.lean)} (no crowd edge).`
        : `Counter-trade drives **${cDir.toUpperCase()}**; Funding/OI unavailable.`,
    )
  } else if (fundingActive && !counterActive) {
    agreement = counter ? 'partial' : 'single-source'
    action = actionFromDirection(fDir)
    conviction = clampScore(fW * (counter ? 0.7 : 0.65))
    reasons.push(
      counter
        ? `Funding/OI drives **${fDir.toUpperCase()}** (${leanLabel(fundingOi!.lean)}); counter-trade is neutral on 7d path.`
        : `Funding/OI drives **${fDir.toUpperCase()}** (${leanLabel(fundingOi!.lean)}); counter-trade path unavailable.`,
    )
  } else {
    agreement = 'none'
    action = 'STAY_OUT'
    conviction = clampScore(
      Math.max(
        fundingOi?.lean === 'no-edge' ? fundingOi.confidence : 70,
        counter?.signal === 'neutral' ? 70 : 0,
        70,
      ),
    )
    reasons.push('No tradeable edge: counter-trade is neutral and Funding/OI has no crowd pressure.')
  }

  // Driver detail lines
  if (counter) {
    const px =
      counter.priceChangePct != null && Number.isFinite(counter.priceChangePct)
        ? `${counter.priceChangePct >= 0 ? '+' : ''}${counter.priceChangePct.toFixed(2)}% over 7d`
        : '7d path'
    reasons.push(
      `Counter-trade: **${counter.signal.toUpperCase()}** · conviction ${clampScore(counter.conviction)}/100 · ${px}.`,
    )
  } else {
    reasons.push('Counter-trade: unavailable this cycle.')
  }

  if (fundingOi) {
    reasons.push(
      `Funding/OI: **${leanLabel(fundingOi.lean)}** · edge ${fundingOi.edgeScore}/100 · strength ${fundingOi.strength}.`,
    )
    for (const line of fundingOi.reasons.slice(0, 3)) {
      reasons.push(line)
    }
  } else {
    reasons.push('Funding/OI: unavailable this cycle.')
  }

  // Playbook
  if (action === 'NO_DATA') {
    playbook.push('Retry `/signal` after market data recovers.')
    playbook.push('Do not size from an empty composite.')
  } else if (action === 'STAY_OUT') {
    playbook.push('Primary action: **STAY OUT** — do not invent a directional trade from weak or conflicting legs.')
    if (agreement === 'conflict') {
      playbook.push('Wait until counter-trade and Funding/OI re-align, then re-run `/signal`.')
    } else {
      playbook.push(
        'Action trigger: 7d price move ≥ ~1.5% (counter-trade) and/or elevated funding with high OI.',
      )
    }
    playbook.push('Use `/position` for book risk and `/market` for breadth.')
  } else {
    const side = action === 'LONG' ? 'long' : 'short'
    const opposite = action === 'LONG' ? 'short' : 'long'
    playbook.push(
      agreement === 'aligned'
        ? `Primary action: **${action}** with multi-factor agreement — only with hard invalidation.`
        : `Primary action: **${action}** from the dominant leg — size discounted until the second leg confirms.`,
    )
    playbook.push(`Prefer ${side}-side setups; do not chase ${opposite} size into this composite.`)
    playbook.push(
      `Suggested size: ~${sizeFromConviction(action, conviction)}% of market max leverage (advisory, not an order).`,
    )
    if (fundingOi && (fundingOi.lean === 'fade-longs' || fundingOi.lean === 'fade-shorts')) {
      playbook.push(...fundingOi.playbook.slice(0, 2))
    } else {
      playbook.push(`Invalidation: re-run \`/signal ${symbol}\` if 7d path flips or Funding/OI upgrades to a conflict.`)
    }
  }

  return {
    symbol,
    action,
    conviction,
    sizeHintPct: sizeFromConviction(action, conviction),
    agreement,
    fundingOi,
    counter,
    reasons,
    playbook,
    shadowOnly: true,
  }
}

export function formatCompositeMarketSignal(result: CompositeMarketSignal): string {
  const heading = `🎯 SIGNAL — ${result.symbol}`

  if (result.action === 'NO_DATA') {
    return [
      heading,
      'Action: **NO DATA**',
      ...result.reasons.map((line) => `• ${line}`),
      '',
      'Playbook',
      ...result.playbook.map((line) => `• ${line}`),
      '',
      'Advisory only; this output does not alter trading decisions.',
    ].join('\n')
  }

  const actionLine =
    result.action === 'STAY_OUT'
      ? `Action: **STAY OUT** · certainty **${result.conviction}/100** · size **0%**`
      : `Action: **${result.action}** · conviction **${result.conviction}/100** · size **${result.sizeHintPct}% of max lev**`

  const agreementLine = `Agreement: **${result.agreement.toUpperCase()}** (counter-trade 7d + Funding/OI)`

  return [
    heading,
    actionLine,
    agreementLine,
    '',
    'Drivers',
    ...result.reasons.map((line) => `• ${line}`),
    '',
    'Playbook',
    ...result.playbook.map((line) => `• ${line}`),
    '',
    'Advisory only; this output does not alter trading decisions.',
  ].join('\n')
}
