export const MARKET_FEATURE_METHODOLOGY_VERSION = 'market-feature-snapshot-v1.0.0'
export const MARKET_FEATURE_SOURCE_PROVIDER = 'hyperliquid-meta-and-asset-ctxs'

export type MarketFeatureSnapshot = {
  symbol: string
  observedAtMs: number
  markPriceUsd: number | null
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
  oraclePriceUsd: number | null
  basisBps: number | null
  extras?: Record<string, unknown>
}

export type MarketFeatureDeltas = {
  dFunding: number | null
  dOpenInterestUsd: number | null
  dVolume24hUsd: number | null
  dMarkPriceUsd: number | null
  lookbackMs: number | null
  priorObservedAtMs: number | null
  missing: Array<'dFunding' | 'dOpenInterestUsd' | 'dVolume24hUsd' | 'dMarkPriceUsd'>
}

export type MarketStateVector = {
  r_t: number | null
  dr_t: number | null
  F_t: number | null
  dF_t: number | null
  OI_t: number | null
  dOI_t: number | null
  V_t: number | null
  dV_t: number | null
  B_t: number | null
  dB_t: number | null
  OF_t: number | null
  L_t: number | null
  missing: string[]
  proxies: {
    oi_to_volume_24h: number | null
    price_change_4h_pct: number | null
    price_change_24h_pct: number | null
  }
  normalization: 'absolute_thresholds_v2' | 'mad_z_v1'
}

export type FeatureSnapshotIngestResult = {
  scanned: number
  qualified: number
  inserted: number
  pruned: number
  staleSkipped: number
  observedAtMs: number
}
