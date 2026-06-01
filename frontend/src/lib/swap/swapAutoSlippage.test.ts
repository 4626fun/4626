import { describe, expect, it } from 'vitest'

import {
  formatSlippagePctForDisplay,
  parsePriceImpactPercentFromLabel,
  pickNextSwapSlippageEscalationPct,
  resolveAutoSwapSlippagePct,
  resolveSwapSendRetrySlippagePct,
} from '@/lib/swap/swapAutoSlippage'
import { PreflightSimulationRejectionError } from '@/lib/aa/coinbaseErc4337ErrorUtils'

describe('resolveAutoSwapSlippagePct', () => {
  it('uses 5% floor for canonical Zora routes', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: true,
        executionMode: 'canonical',
      }),
    ).toBe(5)
  })

  it('uses 2% floor for EOA Zora routes', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: true,
        executionMode: 'eoa',
      }),
    ).toBe(2)
  })

  it('uses 2% floor for canonical Uniswap routes', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: false,
        executionMode: 'canonical',
        quotedProvider: 'uniswap',
      }),
    ).toBe(2)
  })

  it('bumps slippage when price impact is high', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: false,
        executionMode: 'canonical',
        priceImpactPercent: 8,
      }),
    ).toBe(10)
  })

  it('respects quoted Zora provider without prefer flag', () => {
    expect(
      resolveAutoSwapSlippagePct({
        quotedProvider: 'zora',
        executionMode: 'canonical',
      }),
    ).toBe(5)
  })
})

describe('parsePriceImpactPercentFromLabel', () => {
  it('parses formatted impact labels', () => {
    expect(parsePriceImpactPercentFromLabel('4.25%')).toBe(4.25)
    expect(parsePriceImpactPercentFromLabel('<0.01%')).toBe(0.01)
  })
})

describe('pickNextSwapSlippageEscalationPct', () => {
  it('steps through the auto slippage ladder', () => {
    expect(pickNextSwapSlippageEscalationPct(2)).toBe(5)
    expect(pickNextSwapSlippageEscalationPct(5)).toBe(10)
    expect(pickNextSwapSlippageEscalationPct(30)).toBeNull()
  })
})

describe('resolveSwapSendRetrySlippagePct', () => {
  const preflightErr = new PreflightSimulationRejectionError(
    'This swap would fail on-chain — usually because the quote is stale, slippage is too tight',
  )

  it('escalates slippage on the first retry when auto mode allows it', () => {
    expect(
      resolveSwapSendRetrySlippagePct({
        sendAttempt: 0,
        activeSlippagePct: 5,
        slippageAuto: true,
        parsedSlippage: 0.5,
        slippageEscalationCapPct: 30,
        pickNext: pickNextSwapSlippageEscalationPct,
        sendError: preflightErr,
        isRetryable: () => true,
      }),
    ).toBe(10)
  })

  it('refreshes at the same slippage when manual mode blocks escalation', () => {
    expect(
      resolveSwapSendRetrySlippagePct({
        sendAttempt: 0,
        activeSlippagePct: 5,
        slippageAuto: false,
        parsedSlippage: 5,
        slippageEscalationCapPct: 5,
        pickNext: pickNextSwapSlippageEscalationPct,
        sendError: preflightErr,
        isRetryable: () => true,
      }),
    ).toBe(5)
  })

  it('returns null when retryable but not the first send attempt', () => {
    expect(
      resolveSwapSendRetrySlippagePct({
        sendAttempt: 1,
        activeSlippagePct: 30,
        slippageAuto: true,
        parsedSlippage: 0.5,
        slippageEscalationCapPct: 30,
        pickNext: pickNextSwapSlippageEscalationPct,
        sendError: preflightErr,
        isRetryable: () => true,
      }),
    ).toBeNull()
  })
})

describe('formatSlippagePctForDisplay', () => {
  it('formats integers and decimals cleanly', () => {
    expect(formatSlippagePctForDisplay(5)).toBe('5')
    expect(formatSlippagePctForDisplay(0.5)).toBe('0.5')
    expect(formatSlippagePctForDisplay(10)).toBe('10')
  })
})
