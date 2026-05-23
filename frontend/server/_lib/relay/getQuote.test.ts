import { describe, expect, it } from 'vitest'

import {
  extractFromRelayQuoteResponse,
  deriveRelayOwnerMutationDepositQuoteSeedWei,
  relayQuoteUsesNonNativeInput,
  resolveNonNativeRelayQuoteError,
  resolveQuotedNativeDepositWei,
  RELAY_OWNER_MUTATION_FEES_GAS_TO_DEPOSIT_MULTIPLIER,
} from './getQuote.js'
import { MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI } from '../../../src/lib/wallet/cswOwnerAbi.js'

describe('deriveRelayOwnerMutationDepositQuoteSeedWei', () => {
  it('scales zero-quote fees.gas into a native deposit seed', () => {
    const feesGas = 148_913_182_984n
    const extract = extractFromRelayQuoteResponse({
      fees: { gas: { amount: feesGas.toString() } },
    })
    expect(
      deriveRelayOwnerMutationDepositQuoteSeedWei({
        zeroQuoteExtract: extract,
        gasPriceWei: null,
      }),
    ).toBe(feesGas * RELAY_OWNER_MUTATION_FEES_GAS_TO_DEPOSIT_MULTIPLIER)
  })

  it('falls back to live gasPrice × overhead when fees.gas is absent', () => {
    const extract = extractFromRelayQuoteResponse({ fees: { gas: { amount: '0' } } })
    expect(
      deriveRelayOwnerMutationDepositQuoteSeedWei({
        zeroQuoteExtract: extract,
        gasPriceWei: 6_000_000n,
      }),
    ).toBe(6_000_000n * 300_000n * 10n)
  })

  it('never returns below MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI', () => {
    const extract = extractFromRelayQuoteResponse({ fees: { gas: { amount: '1000' } } })
    expect(
      deriveRelayOwnerMutationDepositQuoteSeedWei({
        zeroQuoteExtract: extract,
        gasPriceWei: 1n,
      }),
    ).toBe(MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI)
  })
})

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
                value: '1000000',
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: '1000000',
          currency: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
        },
      },
      protocol: { v2: { paymentDetails: null } },
    })
    expect(relayQuoteUsesNonNativeInput(extract)).toBe(true)
    expect(resolveNonNativeRelayQuoteError(extract)).toMatch(/USDC/)
    expect(resolveQuotedNativeDepositWei(extract)).toBeNull()
  })
})
