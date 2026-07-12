import type { FineRegime } from './regimeTaxonomy.js'

export type PriceOiCell =
  | 'new_longs'
  | 'short_covering'
  | 'new_shorts'
  | 'long_unwind'
  | 'unknown'

export function classifyPriceOiJoint(params: {
  priceDelta: number | null
  oiDelta: number | null
}): PriceOiCell {
  if (params.priceDelta == null || params.oiDelta == null) return 'unknown'
  if (!Number.isFinite(params.priceDelta) || !Number.isFinite(params.oiDelta)) return 'unknown'
  const priceUp = params.priceDelta > 0
  const priceDown = params.priceDelta < 0
  const oiUp = params.oiDelta > 0
  const oiDown = params.oiDelta < 0
  if (priceUp && oiUp) return 'new_longs'
  if (priceUp && oiDown) return 'short_covering'
  if (priceDown && oiUp) return 'new_shorts'
  if (priceDown && oiDown) return 'long_unwind'
  return 'unknown'
}

export function fineRegimeFromJoint(params: {
  cell: PriceOiCell
  fundingRate: number | null
  fundingZ: number | null
  oiParticipationHigh: boolean
  exhaustionHint: boolean
  cascadeHint: boolean
}): FineRegime {
  if (params.cascadeHint) return 'liquidation_cascade'
  if (params.cell === 'unknown') {
    // Without ΔOI, refuse false precision on the four joint cells.
    if (params.fundingRate == null) return 'insufficient_data'
    const absFunding = Math.abs(params.fundingRate)
    if (absFunding >= 0.00025 && params.oiParticipationHigh && params.exhaustionHint) {
      return params.fundingRate > 0 ? 'long_exhaustion' : 'short_exhaustion'
    }
    if (absFunding >= 0.00008 && params.oiParticipationHigh) {
      return params.fundingRate > 0 ? 'crowded_long_continuation' : 'crowded_short_continuation'
    }
    return 'neutral_or_ambiguous'
  }

  const funding = params.fundingRate ?? 0
  switch (params.cell) {
    case 'new_longs':
      if (params.exhaustionHint && funding > 0) return 'long_exhaustion'
      if (params.oiParticipationHigh && funding > 0) return 'crowded_long_continuation'
      return 'new_long_accumulation'
    case 'new_shorts':
      if (params.exhaustionHint && funding < 0) return 'short_exhaustion'
      if (params.oiParticipationHigh && funding < 0) return 'crowded_short_continuation'
      return 'new_short_accumulation'
    case 'short_covering':
      return 'short_covering'
    case 'long_unwind':
      return 'long_unwind'
    default: {
      const _exhaustive: never = params.cell
      void _exhaustive
      return 'neutral_or_ambiguous'
    }
  }
}
