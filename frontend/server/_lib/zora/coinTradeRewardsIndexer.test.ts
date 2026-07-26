import { describe, expect, it } from 'vitest'

import {
  deriveFeeBucketsFromMarketRewards,
  rawAmountToUsd,
  resolveCurrencyUsdPrice,
  USDC_BASE_ADDRESS,
  V4_EVENT_MARKET_SHARE,
  V4_LP_OF_TOTAL,
  V4_DOPPLER_OF_TOTAL,
  ZORA_TOKEN_ADDRESS,
} from './coinTradeRewardsIndexer.js'

describe('coinTradeRewardsIndexer helpers', () => {
  it('converts raw token amounts to USD', () => {
    expect(rawAmountToUsd(10n ** 18n, 18, 0.01)).toBeCloseTo(0.01, 8)
    expect(rawAmountToUsd(1_000_000n, 6, 1)).toBeCloseTo(1, 8)
    expect(rawAmountToUsd(0n, 18, 1)).toBe(0)
  })

  it('derives v4 LP and Doppler from observed market rewards when Doppler missing', () => {
    const M = 79
    const buckets = deriveFeeBucketsFromMarketRewards(
      {
        creatorUsd: 50,
        platformUsd: 20,
        tradeRefUsd: 4,
        protocolUsd: 5,
      },
      'v4',
    )
    expect(buckets.creatorUsd).toBe(50)
    expect(buckets.platformUsd).toBe(20)
    expect(buckets.tradeRefUsd).toBe(4)
    expect(buckets.protocolUsd).toBe(5)
    expect(buckets.dopplerUsd).toBeCloseTo(M * (V4_DOPPLER_OF_TOTAL / V4_EVENT_MARKET_SHARE), 8)
    expect(buckets.lpUsd).toBeCloseTo(M * (V4_LP_OF_TOTAL / V4_EVENT_MARKET_SHARE), 8)
    expect(buckets.totalUsd).toBeCloseTo(M + buckets.lpUsd + buckets.dopplerUsd, 8)
  })

  it('uses on-chain Doppler from CoinMarketRewardsV4 and still derives LP', () => {
    const M = 79
    const buckets = deriveFeeBucketsFromMarketRewards(
      {
        creatorUsd: 50,
        platformUsd: 20,
        tradeRefUsd: 4,
        protocolUsd: 5,
        dopplerUsd: 1.25,
      },
      'v4',
    )
    expect(buckets.dopplerUsd).toBe(1.25)
    expect(buckets.lpUsd).toBeCloseTo(M * (V4_LP_OF_TOTAL / V4_EVENT_MARKET_SHARE), 8)
    expect(buckets.totalUsd).toBeCloseTo(M + buckets.lpUsd + 1.25, 8)
  })

  it('keeps legacy fees as on-chain market sum with zero LP/Doppler', () => {
    const buckets = deriveFeeBucketsFromMarketRewards(
      {
        creatorUsd: 150,
        platformUsd: 75,
        tradeRefUsd: 0,
        protocolUsd: 75,
      },
      'legacy',
    )
    expect(buckets).toEqual({
      creatorUsd: 150,
      platformUsd: 75,
      tradeRefUsd: 0,
      protocolUsd: 75,
      lpUsd: 0,
      dopplerUsd: 0,
      totalUsd: 300,
    })
  })

  it('resolves USDC at $1 and ZORA from sample coin pool price', async () => {
    await expect(resolveCurrencyUsdPrice(USDC_BASE_ADDRESS)).resolves.toBe(1)
    await expect(
      resolveCurrencyUsdPrice(ZORA_TOKEN_ADDRESS, {
        sampleCoin: {
          priceInUsdc: '0.002',
          priceInPoolToken: '0.25',
          poolCurrencyAddress: ZORA_TOKEN_ADDRESS,
        },
      }),
    ).resolves.toBeCloseTo(0.008, 8)
    await expect(
      resolveCurrencyUsdPrice(ZORA_TOKEN_ADDRESS, { envPrice: 0.0123 }),
    ).resolves.toBeCloseTo(0.0123, 8)
  })
})
