export type FundingOiRegimeInput = {
  symbol: string
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
}

export type FundingOiRegime =
  | 'crowded-longs'
  | 'crowded-shorts'
  | 'balanced'
  | 'insufficient-data'

export type FundingBias = 'longs-paying' | 'shorts-paying' | 'flat' | 'unknown'
export type OiParticipation = 'high' | 'moderate' | 'low' | 'unknown'

type FundingOiField = Exclude<keyof FundingOiRegimeInput, 'symbol'>

export type FundingOiRegimeResult = {
  symbol: string
  regime: FundingOiRegime
  confidence: number
  fundingBias: FundingBias
  oiParticipation: OiParticipation
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
  oiToVolumeRatio: number | null
  missingFields: FundingOiField[]
  reasons: string[]
  shadowOnly: true
}

const FLAT_FUNDING_ABS = 0.00001
const ELEVATED_FUNDING_ABS = 0.0001
const HIGH_OI_TO_VOLUME = 0.6
const MODERATE_OI_TO_VOLUME = 0.3

function isUsableNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
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
      confidence: 0,
      fundingBias: 'unknown',
      oiParticipation: 'unknown',
      fundingRate: input.fundingRate,
      openInterestUsd: input.openInterestUsd,
      volume24hUsd: input.volume24hUsd,
      priceChange24hPct: input.priceChange24hPct,
      oiToVolumeRatio: null,
      missingFields: invalidFields,
      reasons: [symbol ? `Missing or invalid fields: ${invalidFields.join(', ')}` : 'Symbol is missing'],
      shadowOnly: true,
    }
  }

  const fundingRate = input.fundingRate as number
  const openInterestUsd = input.openInterestUsd as number
  const volume24hUsd = input.volume24hUsd as number
  const priceChange24hPct = input.priceChange24hPct as number
  const oiToVolumeRatio = openInterestUsd / volume24hUsd
  const absFunding = Math.abs(fundingRate)
  const fundingBias: FundingBias =
    absFunding < FLAT_FUNDING_ABS ? 'flat' : fundingRate > 0 ? 'longs-paying' : 'shorts-paying'
  const oiParticipation: OiParticipation =
    oiToVolumeRatio >= HIGH_OI_TO_VOLUME
      ? 'high'
      : oiToVolumeRatio >= MODERATE_OI_TO_VOLUME
        ? 'moderate'
        : 'low'

  const crowded = absFunding >= ELEVATED_FUNDING_ABS && oiParticipation === 'high'
  const regime: FundingOiRegime = crowded
    ? fundingRate > 0
      ? 'crowded-longs'
      : 'crowded-shorts'
    : 'balanced'

  const fundingStrength = Math.min(1, absFunding / ELEVATED_FUNDING_ABS)
  const participationStrength = Math.min(1, oiToVolumeRatio / HIGH_OI_TO_VOLUME)
  const directionAligned =
    (fundingRate > 0 && priceChange24hPct > 0) || (fundingRate < 0 && priceChange24hPct < 0)
  const confidence = Math.round(
    Math.min(100, (fundingStrength * 0.45 + participationStrength * 0.4 + (directionAligned ? 0.15 : 0)) * 100),
  )

  return {
    symbol,
    regime,
    confidence,
    fundingBias,
    oiParticipation,
    fundingRate,
    openInterestUsd,
    volume24hUsd,
    priceChange24hPct,
    oiToVolumeRatio,
    missingFields: [],
    reasons: [
      `Funding is ${fundingBias} at ${(fundingRate * 100).toFixed(4)}%.`,
      `OI/24h-volume is ${oiToVolumeRatio.toFixed(2)} (${oiParticipation} participation).`,
      `24h price change is ${priceChange24hPct >= 0 ? '+' : ''}${priceChange24hPct.toFixed(2)}%.`,
    ],
    shadowOnly: true,
  }
}

export function formatFundingOiRegime(result: FundingOiRegimeResult): string {
  const heading = `Shadow Funding/OI Regime for ${result.symbol || 'UNKNOWN'}`
  if (result.regime === 'insufficient-data') {
    return `${heading}\nRegime: INSUFFICIENT-DATA\n${result.reasons.join(' ')}\nAdvisory only; this output does not alter trading decisions.`
  }

  return (
    `${heading}\n` +
    `Regime: ${result.regime.toUpperCase()} (confidence: ${result.confidence}/100)\n` +
    `${result.reasons.join(' ')}\n` +
    'Advisory only; this output does not alter trading decisions.'
  )
}
