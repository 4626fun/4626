import { madZ } from '../marketState/madZ.js'
import {
  computeFeatureDeltas,
  loadFeatureHistory,
  loadPriorMarketFeatureSnapshot,
} from '../marketState/featureSnapshotStore.js'
import type { MarketFeatureSnapshot, MarketStateVector } from '../marketState/types.js'
import { classifyFundingOiRegime, type FundingOiRegimeResult } from '../fundingOiRegime.js'
import { classifyPriceOiJoint, fineRegimeFromJoint } from './priceOiJoint.js'
import { toCoarseRegime, type FineRegime } from './regimeTaxonomy.js'

export const FINE_REGIME_METHODOLOGY_VERSION = 'inv-akita-regime-v1.0.0'

export type FineRegimeResult = {
  symbol: string
  regimeFine: FineRegime
  regimeCoarse: ReturnType<typeof toCoarseRegime>
  confidence: number
  marketState: MarketStateVector
  supportingEvidence: string[]
  contradictingEvidence: string[]
  missingFields: string[]
  fundingOi: FundingOiRegimeResult
  methodologyVersion: typeof FINE_REGIME_METHODOLOGY_VERSION
  shadowOnly: true
}

function oiToVolume(oi: number | null, volume: number | null): number | null {
  if (oi == null || volume == null || volume <= 0) return null
  return oi / volume
}

export async function classifyFineFundingOiRegime(params: {
  snapshot: MarketFeatureSnapshot
  lookbackHours?: number
}): Promise<FineRegimeResult> {
  const symbol = params.snapshot.symbol.trim().toUpperCase()
  const fundingOi = classifyFundingOiRegime({
    symbol,
    fundingRate: params.snapshot.fundingRate,
    openInterestUsd: params.snapshot.openInterestUsd,
    volume24hUsd: params.snapshot.volume24hUsd,
    priceChange24hPct: params.snapshot.priceChange24hPct,
  })

  const prior = await loadPriorMarketFeatureSnapshot({
    symbol,
    beforeObservedAtMs: params.snapshot.observedAtMs,
  })
  const deltas = computeFeatureDeltas({ current: params.snapshot, prior })
  const lookbackHours = params.lookbackHours ?? 168
  const [fundingHistory, oiHistory, returnHistory] = await Promise.all([
    loadFeatureHistory({
      symbol,
      field: 'funding_rate',
      lookbackHours,
      nowMs: params.snapshot.observedAtMs,
    }),
    loadFeatureHistory({
      symbol,
      field: 'open_interest_usd',
      lookbackHours: Math.min(lookbackHours, 72),
      nowMs: params.snapshot.observedAtMs,
    }),
    loadFeatureHistory({
      symbol,
      field: 'price_change_24h_pct',
      lookbackHours: Math.min(lookbackHours, 72),
      nowMs: params.snapshot.observedAtMs,
    }),
  ])

  const fundingZ = madZ(params.snapshot.fundingRate, fundingHistory)
  const oiDeltaZ = madZ(deltas.dOpenInterestUsd, oiHistory.map((value, index, arr) => {
    if (index === 0) return 0
    return value - arr[index - 1]!
  }))
  const returnZ = madZ(params.snapshot.priceChange24hPct, returnHistory)
  const hasMadHistory = fundingHistory.length >= 12
  const normalization: MarketStateVector['normalization'] = hasMadHistory
    ? 'mad_z_v1'
    : 'absolute_thresholds_v2'

  const priceDelta =
    deltas.dMarkPriceUsd != null && prior?.markPriceUsd
      ? deltas.dMarkPriceUsd / prior.markPriceUsd
      : params.snapshot.priceChange24hPct != null
        ? params.snapshot.priceChange24hPct / 100
        : null

  const cell = classifyPriceOiJoint({
    priceDelta,
    oiDelta: deltas.dOpenInterestUsd,
  })

  const exhaustionHint =
    (fundingZ != null && Math.abs(fundingZ) >= 2.0) ||
    (params.snapshot.fundingRate != null && Math.abs(params.snapshot.fundingRate) >= 0.00025)
  const cascadeHint =
    params.snapshot.priceChange24hPct != null &&
    Math.abs(params.snapshot.priceChange24hPct) >= 12 &&
    deltas.dOpenInterestUsd != null &&
    deltas.dOpenInterestUsd < 0

  const regimeFine = fineRegimeFromJoint({
    cell,
    fundingRate: params.snapshot.fundingRate,
    fundingZ,
    oiParticipationHigh: fundingOi.oiParticipation === 'high',
    exhaustionHint,
    cascadeHint,
  })

  const missing = [
    ...deltas.missing.map((field) => {
      if (field === 'dFunding') return 'dF_t'
      if (field === 'dOpenInterestUsd') return 'dOI_t'
      if (field === 'dVolume24hUsd') return 'dV_t'
      return 'dr_t'
    }),
    'B_t',
    'dB_t',
    'OF_t',
    'L_t',
  ]

  const marketState: MarketStateVector = {
    r_t: params.snapshot.priceChange24hPct != null ? params.snapshot.priceChange24hPct / 100 : null,
    dr_t: null,
    F_t: params.snapshot.fundingRate,
    dF_t: deltas.dFunding,
    OI_t: params.snapshot.openInterestUsd,
    dOI_t: deltas.dOpenInterestUsd,
    V_t: params.snapshot.volume24hUsd,
    dV_t: deltas.dVolume24hUsd,
    B_t: params.snapshot.basisBps,
    dB_t: null,
    OF_t: null,
    L_t: null,
    missing,
    proxies: {
      oi_to_volume_24h: oiToVolume(params.snapshot.openInterestUsd, params.snapshot.volume24hUsd),
      price_change_4h_pct: null,
      price_change_24h_pct: params.snapshot.priceChange24hPct,
    },
    normalization,
  }

  const supportingEvidence = [...fundingOi.reasons]
  if (cell !== 'unknown') supportingEvidence.push(`price×OI joint cell: ${cell}`)
  if (fundingZ != null) supportingEvidence.push(`funding MAD-z=${fundingZ.toFixed(2)}`)
  if (oiDeltaZ != null) supportingEvidence.push(`OI-delta MAD-z=${oiDeltaZ.toFixed(2)}`)
  if (returnZ != null) supportingEvidence.push(`return MAD-z=${returnZ.toFixed(2)}`)

  const contradictingEvidence: string[] = []
  if (cell === 'unknown') {
    contradictingEvidence.push('ΔOI unavailable — joint price×OI cell not claimed')
  }
  if (!hasMadHistory) {
    contradictingEvidence.push('Insufficient history for MAD-z; using absolute thresholds')
  }

  const completeness = Math.max(0, 1 - missing.length / 12)
  const confidence = Math.max(
    0,
    Math.min(
      1,
      (fundingOi.confidence / 100) * 0.55 + completeness * 0.25 + (cell === 'unknown' ? 0 : 0.2),
    ),
  )

  return {
    symbol,
    regimeFine,
    regimeCoarse: toCoarseRegime(regimeFine),
    confidence,
    marketState,
    supportingEvidence,
    contradictingEvidence,
    missingFields: missing,
    fundingOi,
    methodologyVersion: FINE_REGIME_METHODOLOGY_VERSION,
    shadowOnly: true,
  }
}
