export type FundingOiRegimeInput = {
  symbol: string
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
}

/** DB-stable regime labels (migration CHECK constraint). */
export type FundingOiRegime =
  | 'crowded-longs'
  | 'crowded-shorts'
  | 'balanced'
  | 'insufficient-data'

export type FundingBias = 'longs-paying' | 'shorts-paying' | 'flat' | 'unknown'
export type OiParticipation = 'high' | 'moderate' | 'low' | 'unknown'

/** Product lean shown by `/signal` (not persisted). */
export type FundingOiSignalLean =
  | 'fade-longs'
  | 'fade-shorts'
  | 'watch-longs'
  | 'watch-shorts'
  | 'no-edge'
  | 'insufficient-data'

export type FundingOiSignalStrength = 'none' | 'weak' | 'moderate' | 'strong'

type FundingOiField = Exclude<keyof FundingOiRegimeInput, 'symbol'>

export type FundingOiRegimeResult = {
  symbol: string
  regime: FundingOiRegime
  lean: FundingOiSignalLean
  strength: FundingOiSignalStrength
  /** Conviction in the lean (for no-edge: certainty there is no Funding/OI edge). */
  confidence: number
  /** 0–100 how much tradeable Funding/OI edge is present. */
  edgeScore: number
  fundingBias: FundingBias
  oiParticipation: OiParticipation
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
  oiToVolumeRatio: number | null
  missingFields: FundingOiField[]
  reasons: string[]
  playbook: string[]
  shadowOnly: true
}

// Hyperliquid funding is typically quoted as a fractional rate per hour.
// 0.00001 = 0.001%/period, 0.00005 = 0.005%, 0.0001 = 0.01%, 0.0003 = 0.03%.
const FLAT_FUNDING_ABS = 0.00001
const MILD_FUNDING_ABS = 0.00003
const ELEVATED_FUNDING_ABS = 0.00008
const EXTREME_FUNDING_ABS = 0.00025
const HIGH_OI_TO_VOLUME = 0.6
const MODERATE_OI_TO_VOLUME = 0.3
const MEANINGFUL_PRICE_MOVE_PCT = 1.0

function isUsableNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function formatFundingPct(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function strengthFromEdge(edgeScore: number): FundingOiSignalStrength {
  if (edgeScore >= 75) return 'strong'
  if (edgeScore >= 55) return 'moderate'
  if (edgeScore >= 30) return 'weak'
  return 'none'
}

export function classifyFundingOiRegime(input: FundingOiRegimeInput): FundingOiRegimeResult {
  const symbol = input.symbol.trim().toUpperCase()
  const missingFields = (
    ['fundingRate', 'openInterestUsd', 'volume24hUsd', 'priceChange24hPct'] as const
  ).filter((field) => !isUsableNumber(input[field]))

  if (missingFields.length > 0 || !symbol || (input.volume24hUsd ?? 0) <= 0 || (input.openInterestUsd ?? -1) < 0) {
    const invalidFields = [...missingFields]
    if (isUsableNumber(input.volume24hUsd) && input.volume24hUsd <= 0 && !invalidFields.includes('volume24hUsd')) {
      invalidFields.push('volume24hUsd')
    }
    if (isUsableNumber(input.openInterestUsd) && input.openInterestUsd < 0 && !invalidFields.includes('openInterestUsd')) {
      invalidFields.push('openInterestUsd')
    }
    return {
      symbol,
      regime: 'insufficient-data',
      lean: 'insufficient-data',
      strength: 'none',
      confidence: 0,
      edgeScore: 0,
      fundingBias: 'unknown',
      oiParticipation: 'unknown',
      fundingRate: input.fundingRate,
      openInterestUsd: input.openInterestUsd,
      volume24hUsd: input.volume24hUsd,
      priceChange24hPct: input.priceChange24hPct,
      oiToVolumeRatio: null,
      missingFields: invalidFields,
      reasons: [symbol ? `Missing or invalid fields: ${invalidFields.join(', ')}` : 'Symbol is missing'],
      playbook: ['Retry `/signal` after market data recovers.', 'Do not size from an incomplete snapshot.'],
      shadowOnly: true,
    }
  }

  const fundingRate = input.fundingRate as number
  const openInterestUsd = input.openInterestUsd as number
  const volume24hUsd = input.volume24hUsd as number
  const priceChange24hPct = input.priceChange24hPct as number
  const oiToVolumeRatio = openInterestUsd / volume24hUsd
  const absFunding = Math.abs(fundingRate)
  const absPrice = Math.abs(priceChange24hPct)

  const fundingBias: FundingBias =
    absFunding < FLAT_FUNDING_ABS ? 'flat' : fundingRate > 0 ? 'longs-paying' : 'shorts-paying'
  const oiParticipation: OiParticipation =
    oiToVolumeRatio >= HIGH_OI_TO_VOLUME
      ? 'high'
      : oiToVolumeRatio >= MODERATE_OI_TO_VOLUME
        ? 'moderate'
        : 'low'

  const fundingTier =
    absFunding >= EXTREME_FUNDING_ABS
      ? 3
      : absFunding >= ELEVATED_FUNDING_ABS
        ? 2
        : absFunding >= MILD_FUNDING_ABS
          ? 1
          : 0
  const participationTier = oiParticipation === 'high' ? 2 : oiParticipation === 'moderate' ? 1 : 0
  const directionAligned =
    (fundingRate > 0 && priceChange24hPct > 0) || (fundingRate < 0 && priceChange24hPct < 0)
  const directionOpposed =
    (fundingRate > 0 && priceChange24hPct < 0) || (fundingRate < 0 && priceChange24hPct > 0)
  const meaningfulPrice = absPrice >= MEANINGFUL_PRICE_MOVE_PCT

  // Edge score = how much tradeable Funding/OI pressure is present.
  // Requires directional funding; pure high OI alone is not a fade signal.
  let edgeScore = 0
  if (fundingTier > 0) {
    edgeScore += fundingTier === 3 ? 48 : fundingTier === 2 ? 36 : 18
    edgeScore += participationTier === 2 ? 28 : participationTier === 1 ? 16 : 4
    if (directionAligned && meaningfulPrice) edgeScore += 18
    else if (directionOpposed && meaningfulPrice) edgeScore += 8
    else edgeScore += 4
  } else if (participationTier === 2 && absFunding >= FLAT_FUNDING_ABS) {
    // Sticky OI with only tiny directional funding → weak watch edge.
    edgeScore = 22
  }

  edgeScore = clampScore(edgeScore)
  const strength = strengthFromEdge(edgeScore)

  let lean: FundingOiSignalLean = 'no-edge'
  let regime: FundingOiRegime = 'balanced'
  let confidence = 0

  const longSide = fundingRate > 0
  const shortSide = fundingRate < 0

  if (fundingTier >= 2 && participationTier >= 2) {
    // Elevated/extreme funding + high OI → full fade lean.
    lean = longSide ? 'fade-longs' : 'fade-shorts'
    regime = longSide ? 'crowded-longs' : 'crowded-shorts'
    confidence = clampScore(edgeScore)
  } else if (fundingTier >= 2 && participationTier >= 1) {
    // Elevated funding without full high OI still gets a fade, lower strength.
    lean = longSide ? 'fade-longs' : 'fade-shorts'
    regime = longSide ? 'crowded-longs' : 'crowded-shorts'
    confidence = clampScore(edgeScore - 8)
  } else if (fundingTier >= 1 && participationTier >= 1) {
    // Mild pressure building — watch, not full fade.
    lean = longSide ? 'watch-longs' : shortSide ? 'watch-shorts' : 'no-edge'
    regime = 'balanced'
    confidence = clampScore(40 + edgeScore * 0.35)
  } else if (fundingTier >= 1) {
    lean = longSide ? 'watch-longs' : shortSide ? 'watch-shorts' : 'no-edge'
    regime = 'balanced'
    confidence = clampScore(30 + edgeScore * 0.4)
  } else {
    lean = 'no-edge'
    regime = 'balanced'
    // High confidence that Funding/OI is NOT giving a tradeable edge.
    confidence = clampScore(70 + (participationTier === 0 ? 15 : 5) + (absFunding < FLAT_FUNDING_ABS ? 10 : 0))
    edgeScore = clampScore(Math.min(edgeScore, 25))
  }

  const reasons: string[] = []
  if (fundingBias === 'flat') {
    reasons.push(`Funding is flat at ${formatFundingPct(fundingRate)}/period — no directional squeeze pressure.`)
  } else {
    const fundingLabel =
      fundingTier >= 3 ? 'extreme' : fundingTier >= 2 ? 'elevated' : fundingTier >= 1 ? 'mild' : 'flat'
    reasons.push(
      `Funding is ${fundingLabel} ${fundingBias.replace('-', ' ')} at ${formatFundingPct(fundingRate)}/period.`,
    )
  }
  reasons.push(
    `OI/24h-volume is ${oiToVolumeRatio.toFixed(2)} (${oiParticipation} participation` +
      `${oiParticipation === 'high' ? ' — crowded books vs flow' : ''}).`,
  )
  reasons.push(
    `24h price is ${formatSignedPct(priceChange24hPct)}` +
      (meaningfulPrice && directionAligned
        ? ' and aligned with funding (chase risk).'
        : meaningfulPrice && directionOpposed
          ? ' and opposing funding (divergence).'
          : ' (no strong momentum confirmation).'),
  )

  const playbook = buildPlaybook({
    lean,
    strength,
    symbol,
    fundingTier,
    oiParticipation,
  })

  return {
    symbol,
    regime,
    lean,
    strength,
    confidence,
    edgeScore,
    fundingBias,
    oiParticipation,
    fundingRate,
    openInterestUsd,
    volume24hUsd,
    priceChange24hPct,
    oiToVolumeRatio,
    missingFields: [],
    reasons,
    playbook,
    shadowOnly: true,
  }
}

function buildPlaybook(params: {
  lean: FundingOiSignalLean
  strength: FundingOiSignalStrength
  symbol: string
  fundingTier: number
  oiParticipation: OiParticipation
}): string[] {
  const { lean, strength, symbol, fundingTier, oiParticipation } = params
  switch (lean) {
    case 'fade-longs':
      return [
        strength === 'strong'
          ? 'Primary lean: fade long crowding — prefer short-side mean-reversion only with hard invalidation.'
          : 'Primary lean: lean against long crowding — wait for a trigger; do not market-chase shorts.',
        'Do not add long size into elevated positive funding + sticky OI.',
        `Invalidation: funding compresses under ~${formatFundingPct(MILD_FUNDING_ABS)} while price holds highs.`,
        `Re-check: \`/signal ${symbol}\` if funding spikes or OI participation drops.`,
      ]
    case 'fade-shorts':
      return [
        strength === 'strong'
          ? 'Primary lean: fade short crowding — prefer long-side mean-reversion only with hard invalidation.'
          : 'Primary lean: lean against short crowding — wait for a trigger; do not market-chase longs.',
        'Do not add short size into elevated negative funding + sticky OI.',
        `Invalidation: funding compresses above ~-${(MILD_FUNDING_ABS * 100).toFixed(4)}% while price holds lows.`,
        `Re-check: \`/signal ${symbol}\` if funding spikes or OI participation drops.`,
      ]
    case 'watch-longs':
      return [
        'Primary lean: watch long pressure building — not a full fade yet.',
        fundingTier >= 1 && oiParticipation !== 'high'
          ? 'Funding is directional but OI participation is not fully crowded; wait for confirmation.'
          : 'Sticky OI with mild long funding — prepare fade criteria, do not force entries.',
        `Upgrade to fade only if funding clears ~${formatFundingPct(ELEVATED_FUNDING_ABS)}/period with high OI.`,
        `Stand aside on size-ups until \`/signal ${symbol}\` upgrades strength.`,
      ]
    case 'watch-shorts':
      return [
        'Primary lean: watch short pressure building — not a full fade yet.',
        fundingTier >= 1 && oiParticipation !== 'high'
          ? 'Funding is directional but OI participation is not fully crowded; wait for confirmation.'
          : 'Sticky OI with mild short funding — prepare fade criteria, do not force entries.',
        `Upgrade to fade only if funding clears ~-${(ELEVATED_FUNDING_ABS * 100).toFixed(4)}%/period with high OI.`,
        `Stand aside on size-ups until \`/signal ${symbol}\` upgrades strength.`,
      ]
    case 'insufficient-data':
      return ['Retry `/signal` after market data recovers.', 'Do not size from an incomplete snapshot.']
    case 'no-edge':
    default:
      return [
        'Primary lean: NO EDGE from Funding/OI — stand aside on mean-reversion fades.',
        'Do not invent a counter-trade from mild funding or high OI alone.',
        `Action trigger: funding ≥ ~${formatFundingPct(ELEVATED_FUNDING_ABS)}/period with high OI/volume, then re-run \`/signal ${symbol}\`.`,
        'Use `/position` for book risk and `/market` for breadth; Funding/OI is only one lane.',
      ]
  }
}

function leanHeadline(lean: FundingOiSignalLean): string {
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

export function formatFundingOiRegime(result: FundingOiRegimeResult): string {
  const heading = `🎯 Funding/OI signal — ${result.symbol || 'UNKNOWN'}`
  if (result.lean === 'insufficient-data' || result.regime === 'insufficient-data') {
    return [
      heading,
      `Lean: **${leanHeadline('insufficient-data')}**`,
      result.reasons.join(' '),
      '',
      'Playbook',
      ...result.playbook.map((line) => `• ${line}`),
      '',
      'Advisory only; this output does not alter trading decisions.',
    ].join('\n')
  }

  const strengthLabel = result.strength.toUpperCase()
  const scoreLine =
    result.lean === 'no-edge'
      ? `Edge: **${result.edgeScore}/100** · certainty no-edge **${result.confidence}/100**`
      : `Strength: **${strengthLabel}** · conviction **${result.confidence}/100** · edge **${result.edgeScore}/100**`

  return [
    heading,
    `Lean: **${leanHeadline(result.lean)}**`,
    scoreLine,
    '',
    'Why',
    ...result.reasons.map((line) => `• ${line}`),
    '',
    'Playbook',
    ...result.playbook.map((line) => `• ${line}`),
    '',
    'Advisory only; this output does not alter trading decisions.',
  ].join('\n')
}
