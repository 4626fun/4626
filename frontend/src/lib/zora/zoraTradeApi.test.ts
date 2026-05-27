import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { buildSwapFromZoraQuote, zoraTradeQuoteToResponse } from '@/lib/zora/zoraTradeApi'

const EXECUTION_CSW = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')

describe('zoraTradeApi', () => {
  it('maps Zora quote payload into a classic-compatible trade quote', () => {
    const response = zoraTradeQuoteToResponse({
      tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      tokenOut: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      amountIn: '88920000',
      payload: {
        call: {
          target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
          data: '0xdeadbeef',
          value: '0',
        },
        quote: { amountOut: '1200000000000000000' },
      },
    })

    expect(response.routing).toBe('CLASSIC')
    expect(response.provider).toBe('zora')
    expect((response.quote as any)?.amountOut).toBe('1200000000000000000')
    expect((response.quote as any)?._zoraCall?.target).toBe('0x6ff5693b99212da76ad316178a184ab56d299b43')
  })

  it('builds an executable swap transaction from a Zora classic quote', () => {
    const quote = zoraTradeQuoteToResponse({
      tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      tokenOut: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      amountIn: '88920000',
      payload: {
        call: {
          target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
          data: '0xdeadbeef',
          value: '0',
        },
      },
    })

    const built = buildSwapFromZoraQuote({
      quote,
      executionAddress: EXECUTION_CSW,
      chainId: 8453,
    })

    expect(built.swap.to).toBe(getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43'))
    expect(built.swap.data).toBe('0xdeadbeef')
    expect(built.swap.from).toBe(EXECUTION_CSW)
    expect(String(built.swap.value)).toBe('0')
  })
})
