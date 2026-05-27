import { describe, expect, it } from 'vitest'

import {
  coerceSwapTransactionValue,
  normalizeSwapApiResponsePayload,
  sanitizeClassicQuoteForSwap,
  sanitizeCreateSwapRequestPayload,
} from './swapQuoteSanitize'

describe('coerceSwapTransactionValue', () => {
  it('coerces JSON numbers to decimal strings', () => {
    expect(coerceSwapTransactionValue(0)).toBe('0')
    expect(coerceSwapTransactionValue(42)).toBe('42')
  })

  it('preserves string and hex values', () => {
    expect(coerceSwapTransactionValue('0')).toBe('0')
    expect(coerceSwapTransactionValue('0x0')).toBe('0x0')
    expect(coerceSwapTransactionValue('80028000')).toBe('80028000')
  })
})

describe('sanitizeClassicQuoteForSwap', () => {
  it('strips internal metadata and routing from nested quote payloads', () => {
    const sanitized = sanitizeClassicQuoteForSwap({
      _provider: 'cdp',
      _cdpParams: { network: 'base' },
      routing: 'CLASSIC',
      permitData: { domain: {} },
      input: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '80028000' },
      output: { token: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75', amount: '1' },
      slippage: '0.5',
    })

    expect(sanitized._provider).toBeUndefined()
    expect(sanitized.routing).toBeUndefined()
    expect(sanitized.permitData).toBeUndefined()
    expect(sanitized.slippage).toBe(0.5)
    expect(sanitized.input).toMatchObject({
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amount: '80028000',
    })
  })

  it('unwraps nested quote wrappers and deep-normalizes transaction value', () => {
    const sanitized = sanitizeClassicQuoteForSwap({
      routing: 'CLASSIC',
      requestId: 'req-1',
      permitTransaction: {
        to: '0x0000000000000000000000000000000000000001',
        from: '0x0000000000000000000000000000000000000002',
        data: '0x1234',
        value: 0,
        chainId: 8453,
      },
      quote: {
        input: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: 80028000 },
        output: { token: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75', amount: 1 },
        gasPrice: 1000000000,
        route: [[{ type: 'v3-pool', amountIn: 100, amountOut: 200 }]],
      },
    })

    expect(sanitized.permitTransaction).toBeUndefined()
    expect(sanitized.requestId).toBeUndefined()
    expect((sanitized.input as { amount: string }).amount).toBe('80028000')
    expect((sanitized.output as { amount: string }).amount).toBe('1')
    expect(sanitized.gasPrice).toBe('1000000000')
    const routePool = (sanitized.route as Array<Array<Record<string, unknown>>>)[0]?.[0]
    expect(routePool?.amountIn).toBe('100')
    expect(routePool?.amountOut).toBe('200')
  })
})

describe('normalizeSwapApiResponsePayload', () => {
  it('normalizes numeric swap.value from upstream JSON', () => {
    const normalized = normalizeSwapApiResponsePayload({
      swap: {
        to: '0x0000000000000000000000000000000000000001',
        from: '0x0000000000000000000000000000000000000002',
        data: '0x1234',
        value: 0,
        chainId: 8453,
      },
    }) as { swap: { value: string } }

    expect(normalized.swap.value).toBe('0')
  })
})

describe('sanitizeCreateSwapRequestPayload', () => {
  it('removes permit2Disabled and sanitizes nested quote', () => {
    const sanitized = sanitizeCreateSwapRequestPayload({
      permit2Disabled: true,
      quote: {
        routing: 'CLASSIC',
        _provider: 'cdp',
        input: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '1' },
        output: { token: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75', amount: '1' },
      },
      refreshGasPrice: true,
      simulateTransaction: false,
    })

    expect(sanitized.permit2Disabled).toBeUndefined()
    expect((sanitized.quote as Record<string, unknown>).routing).toBeUndefined()
    expect((sanitized.quote as Record<string, unknown>)._provider).toBeUndefined()
  })
})
