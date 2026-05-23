import { describe, expect, it } from 'vitest'

import {
  extractFromRelayQuoteResponse,
  resolveQuotedNativeDepositWei,
} from './getQuote.js'

describe('resolveQuotedNativeDepositWei', () => {
  it('ignores zero currencyIn.amount fallback from extract', () => {
    const raw = {
      steps: [
        {
          kind: 'transaction',
          requestId: '0x' + 'ab'.repeat(32),
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: '0',
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: '0',
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
      protocol: { v2: { paymentDetails: null } },
    }
    const extract = extractFromRelayQuoteResponse(raw)
    expect(extract.paymentDetails?.amount).not.toBe('0')
    expect(resolveQuotedNativeDepositWei(extract)).toBeNull()
  })

  it('resolves positive currencyIn.amount when paymentDetails is absent', () => {
    const raw = {
      steps: [
        {
          kind: 'transaction',
          requestId: '0x' + 'cd'.repeat(32),
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: '0',
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: '18871666861048',
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
      protocol: { v2: { paymentDetails: null } },
    }
    const extract = extractFromRelayQuoteResponse(raw)
    expect(resolveQuotedNativeDepositWei(extract)).toBe(18_871_666_861_048n)
  })

  it('prefers protocol.v2.paymentDetails.amount when present', () => {
    const extract = extractFromRelayQuoteResponse({
      protocol: {
        v2: {
          paymentDetails: {
            depository: '0xF5042e6ffaC5a625D6719f8bE538837EfFA31577',
            currency: '0x0000000000000000000000000000000000000000',
            amount: '12000000000000',
            chainId: 8453,
          },
        },
      },
      details: {
        currencyIn: {
          amount: '18871666861048',
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
    })
    expect(resolveQuotedNativeDepositWei(extract)).toBe(12_000_000_000_000n)
  })

  it('ignores USDC currencyIn when paymentDetails is absent', () => {
    const extract = extractFromRelayQuoteResponse({
      steps: [
        {
          kind: 'transaction',
          requestId: '0x' + 'ef'.repeat(32),
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: '0',
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: '1000000',
          currency: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        },
      },
      protocol: { v2: { paymentDetails: null } },
    })
    expect(resolveQuotedNativeDepositWei(extract)).toBeNull()
  })
})
