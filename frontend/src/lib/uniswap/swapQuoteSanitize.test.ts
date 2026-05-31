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

  it('normalizes permitData values for Uniswap protobuf JSON', () => {
    const sanitized = sanitizeCreateSwapRequestPayload({
      quote: { input: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '1' } },
      permitData: {
        domain: { name: 'Permit2', chainId: '8453', verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
        types: { PermitSingle: [{ name: 'details', type: 'PermitDetails' }] },
        values: {
          details: {
            token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amount: 1461501637330902918203684832716283019655932542975n,
            expiration: '1893456000',
            nonce: '12',
          },
          spender: '0x2626664c2603336E57B271c5C0b26F421741e481',
          sigDeadline: 1893456000n,
        },
      },
      signature: '0xabc',
    })

    const permit = sanitized.permitData as Record<string, unknown>
    const values = permit.values as Record<string, unknown>
    const details = values.details as Record<string, unknown>
    expect((permit.domain as Record<string, unknown>).chainId).toBe(8453)
    expect(details.amount).toBe('1461501637330902918203684832716283019655932542975')
    expect(details.expiration).toBe('1893456000')
    expect(details.nonce).toBe('12')
    expect(values.sigDeadline).toBe('1893456000')
  })

  it('matches Uniswap trade-api PermitSingle string field conventions', () => {
    const sanitized = sanitizeCreateSwapRequestPayload({
      quote: { input: { token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '1' } },
      permitData: {
        domain: {
          name: 'Permit2',
          chainId: 8453,
          verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        },
        types: {
          PermitSingle: [
            { name: 'details', type: 'PermitDetails' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
          ],
          PermitDetails: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' },
          ],
        },
        values: {
          details: {
            token: { address: '0x624e2e7fDc8903165F64891672267AB0FCB98831', chainId: 8453 },
            amount: '1461501637330902918203684832716283019655932542975',
            expiration: 1779463380,
            nonce: 0,
          },
          spender: '0x6ff5693b99212da76ad316178a184ab56d299b43',
          sigDeadline: 1776873180,
        },
      },
      signature: '0xabc',
    })

    const values = (sanitized.permitData as Record<string, unknown>).values as Record<string, unknown>
    const details = values.details as Record<string, unknown>
    expect(details.token).toBe('0x624e2e7fDc8903165F64891672267AB0FCB98831')
    expect(details.amount).toBe('1461501637330902918203684832716283019655932542975')
    expect(details.expiration).toBe('1779463380')
    expect(details.nonce).toBe('0')
    expect(values.sigDeadline).toBe('1776873180')
  })
})
