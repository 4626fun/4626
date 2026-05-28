import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  buildSwapFromZoraQuote,
  isZoraPermitSignaturePlaceholder,
  mergePermitWithChainNonce,
  quoteNeedsZoraPermitFinalization,
  zoraPermitNonceDrifted,
  zoraTradeQuoteToResponse,
} from '@/lib/zora/zoraTradeApi'

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

  it('treats Zora permit placeholders as unsigned', () => {
    expect(isZoraPermitSignaturePlaceholder('')).toBe(true)
    expect(isZoraPermitSignaturePlaceholder('0x')).toBe(true)
    expect(
      isZoraPermitSignaturePlaceholder(
        'REPLACE_WITH_PERMIT_SIGNATURE_10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      ),
    ).toBe(true)
    expect(
      isZoraPermitSignaturePlaceholder(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
      ),
    ).toBe(false)
  })

  it('detects quotes that still need Permit2 finalization', () => {
    const quote = zoraTradeQuoteToResponse({
      tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      tokenOut: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      amountIn: '1000000',
      payload: {
        call: {
          target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
          data: '0x24856bc30000000000REPLACE_WITH_PERMIT_SIGNATURE_1000000000',
          value: '0',
        },
        permits: [
          {
            signature:
              'REPLACE_WITH_PERMIT_SIGNATURE_10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            permit: {
              sigDeadline: '9999999999',
              spender: '0x0000000000000000000000000000000000000000',
              details: {
                token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: '1000000',
                expiration: 0,
                nonce: 0,
              },
            },
          },
        ],
      },
    })

    expect(quoteNeedsZoraPermitFinalization(quote)).toBe(true)
    expect(() =>
      buildSwapFromZoraQuote({
        quote,
        executionAddress: EXECUTION_CSW,
        chainId: 8453,
      }),
    ).toThrow(/Permit2 signature/i)
  })

  it('merges on-chain Permit2 nonce into the permit payload sent to Zora', () => {
    const merged = mergePermitWithChainNonce(
      {
        sigDeadline: '9999999999',
        spender: '0x6ff5693b99212da76ad316178a184ab56d299b43',
        details: {
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '1000000',
          expiration: 1777703041,
          nonce: 99,
        },
      },
      3,
    )
    expect(merged.details.nonce).toBe(3)
    expect(merged.details.amount).toBe('1000000')
  })

  it('serializes permit payloads without BigInt for API requests', () => {
    const body = {
      signatures: [
        {
          signature: '0xabc',
          permit: {
            sigDeadline: 9999999999n,
            spender: '0x6ff5693b99212da76ad316178a184ab56d299b43',
            details: {
              token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              amount: 1000000n,
              expiration: 0,
              nonce: 0,
            },
          },
        },
      ],
    }
    expect(() => JSON.stringify(body)).toThrow(/BigInt/i)
    const safe = JSON.parse(
      JSON.stringify(body, (_key, val) => (typeof val === 'bigint' ? val.toString() : val)),
    )
    expect(safe.signatures[0].permit.sigDeadline).toBe('9999999999')
    expect(safe.signatures[0].permit.details.amount).toBe('1000000')
  })

  it('detects Permit2 nonce drift for CSW sells before execute', () => {
    expect(zoraPermitNonceDrifted(2, 5)).toBe(true)
    expect(zoraPermitNonceDrifted(2, 2)).toBe(false)
  })
})
