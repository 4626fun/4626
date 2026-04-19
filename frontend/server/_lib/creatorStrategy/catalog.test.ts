import { describe, expect, it } from 'vitest'

import {
  CREATOR_STRATEGY_FEATURE_CATALOG,
  DEFAULT_CREATOR_STRATEGY_PRICE_USDC,
  getCreatorStrategyFeature,
  listCreatorStrategyFeatures,
  toCreatorStrategyFeatureDto,
} from './catalog'

describe('creator strategy catalog', () => {
  it('exposes every feature priced in USDC with 6 decimals', () => {
    for (const feature of listCreatorStrategyFeatures()) {
      // Must be positive and a whole-dollar amount (no sub-cent weirdness).
      expect(feature.priceUsdc).toBeGreaterThan(0n)
      expect(feature.priceUsdc % 10_000n).toBe(0n) // multiple of $0.01
    }
  })

  it('solana_meteora_alpha_vault is priced at the default $100', () => {
    const feature = CREATOR_STRATEGY_FEATURE_CATALOG.solana_meteora_alpha_vault
    expect(feature.priceUsdc).toBe(DEFAULT_CREATOR_STRATEGY_PRICE_USDC)
    expect(feature.priceUsdc).toBe(100_000_000n)
  })

  it('getCreatorStrategyFeature returns null for unknown keys and the entry for known keys', () => {
    expect(getCreatorStrategyFeature('bogus')).toBe(null)
    const known = getCreatorStrategyFeature('solana_meteora_alpha_vault')
    expect(known).not.toBe(null)
    expect(known?.key).toBe('solana_meteora_alpha_vault')
  })

  it('keys are stable identifiers (never include whitespace or non-ascii)', () => {
    for (const key of Object.keys(CREATOR_STRATEGY_FEATURE_CATALOG)) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('toCreatorStrategyFeatureDto formats whole-dollar prices as $X without decimals', () => {
    const feature = CREATOR_STRATEGY_FEATURE_CATALOG.solana_meteora_alpha_vault
    const dto = toCreatorStrategyFeatureDto(feature)
    expect(dto.priceUsdc).toBe('100000000')
    expect(dto.priceUsdcDisplay).toBe('$100')
  })

  it('toCreatorStrategyFeatureDto formats fractional prices with trailing zeros stripped', () => {
    const halfDollarFeature = {
      ...CREATOR_STRATEGY_FEATURE_CATALOG.solana_meteora_alpha_vault,
      priceUsdc: 1_500_000n, // $1.50
    }
    const dto = toCreatorStrategyFeatureDto(halfDollarFeature)
    expect(dto.priceUsdcDisplay).toBe('$1.5')
  })
})
