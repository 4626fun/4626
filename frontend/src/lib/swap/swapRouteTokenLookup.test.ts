import { describe, expect, it } from 'vitest'

import { CONTRACTS } from '@/config/contracts'
import {
  buildSwapRouteTokenLookup,
  resolveKnownBaseRouteTokenAddress,
  resolveSwapRouteTokenMeta,
} from './swapRouteTokenLookup'

describe('swapRouteTokenLookup', () => {
  it('seeds sell/buy tokens and merges hop addresses from route legs', () => {
    const lookup = buildSwapRouteTokenLookup({
      tokenInSymbol: 'USDC',
      tokenInAddress: CONTRACTS.usdc,
      tokenOutSymbol: 'akita',
      tokenOutAddress: '0x1234567890123456789012345678901234567890',
      tokenOutLogoUrl: '/api/v1/token/akita.png',
      routeLegs: [
        {
          protocol: 'v3',
          protocolLabel: 'Uniswap V3',
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          tokenOutAddress: CONTRACTS.weth,
          feePercentLabel: '0.01%',
          poolAddress: null,
        },
        {
          protocol: 'v3',
          protocolLabel: 'Uniswap V3',
          tokenIn: 'WETH',
          tokenOut: 'ZORA',
          tokenOutAddress: CONTRACTS.zora,
          feePercentLabel: '0.30%',
          poolAddress: null,
        },
      ],
    })

    expect(resolveSwapRouteTokenMeta(lookup, 'USDC').address).toBe(CONTRACTS.usdc)
    expect(resolveSwapRouteTokenMeta(lookup, 'WETH').address).toBe(CONTRACTS.weth)
    expect(resolveSwapRouteTokenMeta(lookup, 'ZORA').address).toBe(CONTRACTS.zora)
    expect(resolveSwapRouteTokenMeta(lookup, 'akita').imageUrl).toBe('/api/v1/token/akita.png')
  })

  it('falls back to known Base symbols when lookup is missing', () => {
    expect(resolveKnownBaseRouteTokenAddress('WETH')).toBe(CONTRACTS.weth)
    expect(resolveKnownBaseRouteTokenAddress('zora')).toBe(CONTRACTS.zora)
  })
})
