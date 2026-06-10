import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { AKITA_DEFAULTS } from '@/config/contracts.defaults'

import { mergeZoraHoldingsBundles, zoraHoldingsDtoToBundle } from './walletHoldings'

describe('walletHoldings', () => {
  it('splits creator and content coins in bundle mapping', () => {
    const wallet = getAddress(AKITA_DEFAULTS.token)
    const bundle = zoraHoldingsDtoToBundle({
      wallet,
      asOf: Date.now(),
      portfolioSource: 'debank',
      creator: [
        {
          address: AKITA_DEFAULTS.token,
          symbol: 'AKITA',
          name: 'AKITA',
          coinType: 'CREATOR',
          amount: 10,
          amountFormatted: '10',
          usdValue: 5,
          logoUrl: null,
          chainId: 8453,
        },
      ],
      content: [
        {
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'POST',
          name: 'Example post',
          coinType: 'CONTENT',
          amount: 2,
          amountFormatted: '2',
          usdValue: 1,
          logoUrl: null,
          chainId: 8453,
        },
      ],
      trend: [],
    })

    expect(bundle.creator).toHaveLength(1)
    expect(bundle.creator[0]?.sectionTag).toBe('creator')
    expect(bundle.content).toHaveLength(1)
    expect(bundle.content[0]?.sectionTag).toBe('content')
    expect(bundle.usdValues[AKITA_DEFAULTS.token.toLowerCase()]).toBe(5)
  })

  it('maps trend coins to the trend section tag', () => {
    const wallet = getAddress(AKITA_DEFAULTS.token)
    const bundle = zoraHoldingsDtoToBundle({
      wallet,
      asOf: Date.now(),
      portfolioSource: 'debank',
      creator: [],
      content: [],
      trend: [
        {
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'b20',
          name: 'b20',
          coinType: 'TREND',
          amount: 20_625_318,
          amountFormatted: '20,625,318',
          usdValue: 56.17,
          logoUrl: null,
          chainId: 8453,
        },
      ],
    })

    expect(bundle.trend).toHaveLength(1)
    expect(bundle.trend[0]?.sectionTag).toBe('trend')
    expect(bundle.trayTrend[0]?.symbol).toBe('b20')
  })

  it('merges duplicate token rows across wallets', () => {
    const merged = mergeZoraHoldingsBundles([
      {
        wallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        creator: [],
        content: [],
        trend: [],
        balances: {},
        usdValues: {},
        trayCreator: [
          {
            tokenKey: AKITA_DEFAULTS.token.toLowerCase(),
            tokenAddress: getAddress(AKITA_DEFAULTS.token),
            symbol: 'AKITA',
            name: 'AKITA',
            logoUrl: null,
            amount: 3,
            usdValue: 2,
            walletCount: 1,
          },
        ],
        trayContent: [],
        trayTrend: [],
      },
      {
        wallet: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
        creator: [],
        content: [],
        trend: [],
        balances: {},
        usdValues: {},
        trayCreator: [
          {
            tokenKey: AKITA_DEFAULTS.token.toLowerCase(),
            tokenAddress: getAddress(AKITA_DEFAULTS.token),
            symbol: 'AKITA',
            name: 'AKITA',
            logoUrl: null,
            amount: 7,
            usdValue: 4,
            walletCount: 1,
          },
        ],
        trayContent: [],
        trayTrend: [],
      },
    ])

    expect(merged.creator).toHaveLength(1)
    expect(merged.creator[0]?.amount).toBe(10)
    expect(merged.creator[0]?.walletCount).toBe(2)
  })
})
