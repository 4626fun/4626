/** DB-stable coarse labels (shadow observation CHECK constraint). */
export type CoarseRegime =
  | 'crowded-longs'
  | 'crowded-shorts'
  | 'balanced'
  | 'insufficient-data'

/** Public fine regime taxonomy (InverseAKITA v1). */
export type FineRegime =
  | 'new_long_accumulation'
  | 'new_short_accumulation'
  | 'short_covering'
  | 'long_unwind'
  | 'crowded_long_continuation'
  | 'crowded_short_continuation'
  | 'long_exhaustion'
  | 'short_exhaustion'
  | 'liquidation_cascade'
  | 'neutral_or_ambiguous'
  | 'insufficient_data'

export const FINE_REGIMES: readonly FineRegime[] = [
  'new_long_accumulation',
  'new_short_accumulation',
  'short_covering',
  'long_unwind',
  'crowded_long_continuation',
  'crowded_short_continuation',
  'long_exhaustion',
  'short_exhaustion',
  'liquidation_cascade',
  'neutral_or_ambiguous',
  'insufficient_data',
] as const

export function toCoarseRegime(fine: FineRegime): CoarseRegime {
  switch (fine) {
    case 'long_exhaustion':
    case 'crowded_long_continuation':
    case 'new_long_accumulation':
      return 'crowded-longs'
    case 'short_exhaustion':
    case 'crowded_short_continuation':
    case 'new_short_accumulation':
      return 'crowded-shorts'
    case 'insufficient_data':
      return 'insufficient-data'
    case 'short_covering':
    case 'long_unwind':
    case 'liquidation_cascade':
    case 'neutral_or_ambiguous':
      return 'balanced'
    default: {
      const _exhaustive: never = fine
      void _exhaustive
      return 'balanced'
    }
  }
}

export function isLongExhaustionFamily(regime: FineRegime): boolean {
  return regime === 'long_exhaustion'
}

export function isShortExhaustionFamily(regime: FineRegime): boolean {
  return regime === 'short_exhaustion'
}

export function isDelayFamily(regime: FineRegime): boolean {
  return (
    regime === 'new_long_accumulation' ||
    regime === 'new_short_accumulation' ||
    regime === 'crowded_long_continuation' ||
    regime === 'crowded_short_continuation' ||
    regime === 'short_covering' ||
    regime === 'long_unwind'
  )
}

export function sourceAlignedWithRegime(
  sourceSide: 'LONG' | 'SHORT',
  regime: FineRegime,
): boolean {
  if (sourceSide === 'LONG') {
    return (
      regime === 'new_long_accumulation' ||
      regime === 'crowded_long_continuation' ||
      regime === 'short_covering'
    )
  }
  return (
    regime === 'new_short_accumulation' ||
    regime === 'crowded_short_continuation' ||
    regime === 'long_unwind'
  )
}
