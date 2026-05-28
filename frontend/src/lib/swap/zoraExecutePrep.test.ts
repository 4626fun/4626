import { describe, expect, it } from 'vitest'

import {
  buildZoraExecutePrepSnapshot,
  canFastCanonicalZoraSubmit,
  fingerprintSwapTxData,
  isZoraExecutePrepCalldataMatch,
  isZoraExecutePrepFresh,
  isZoraRouterValidationFresh,
  needsZoraSubmitRefresh,
  ZORA_EXECUTE_PREP_TTL_MS,
} from './zoraExecutePrep'

describe('zoraExecutePrep', () => {
  const swapTx = {
    to: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    from: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    data: '0x24856bc300000000000000000000000000000000000000000000000000000000',
    value: '0',
    chainId: 8453 as const,
  }

  const matchParams = {
    amountIn: '1000000',
    slippagePct: 1,
    tokenIn: '0xtokenin',
    tokenOut: '0xtokenout',
    executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    swapTx,
  }

  it('detects fresh prep when inputs and swap calldata match', () => {
    const now = 1_700_000_000_000
    const prep = buildZoraExecutePrepSnapshot({
      ...matchParams,
      executionAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
      swapTx,
    })
    expect(isZoraExecutePrepFresh(prep, { ...matchParams, now: now + 1_000 })).toBe(true)
  })

  it('keeps calldata match after preparedAt TTL but needs refresh without router validation', () => {
    const prep = buildZoraExecutePrepSnapshot({
      amountIn: '1000000',
      slippagePct: 1,
      tokenIn: '0xa',
      tokenOut: '0xb',
      executionAddress: '0xc',
      swapTx,
    })
    const staleNow = prep.preparedAt + ZORA_EXECUTE_PREP_TTL_MS + 1
    expect(isZoraExecutePrepFresh(prep, { ...matchParams, amountIn: '1000000', tokenIn: '0xa', tokenOut: '0xb', executionAddress: '0xc', now: staleNow })).toBe(false)
    expect(
      isZoraExecutePrepCalldataMatch(prep, {
        amountIn: '1000000',
        slippagePct: 1,
        tokenIn: '0xa',
        tokenOut: '0xb',
        executionAddress: '0xc',
        swapTx,
        now: staleNow,
      }),
    ).toBe(true)
    expect(needsZoraSubmitRefresh(prep, { ...matchParams, amountIn: '1000000', tokenIn: '0xa', tokenOut: '0xb', executionAddress: '0xc', now: staleNow })).toBe(true)
  })

  it('enables fast canonical submit when router was validated at review', () => {
    const now = 1_700_000_000_000
    const prep = buildZoraExecutePrepSnapshot({
      amountIn: '1000000',
      slippagePct: 1,
      tokenIn: '0xa',
      tokenOut: '0xb',
      executionAddress: '0xc',
      swapTx,
      routerValidated: true,
    })
    expect(
      canFastCanonicalZoraSubmit({
        executionMode: 'canonical',
        prep,
        quoteIsZora: true,
        matchParams: {
          amountIn: '1000000',
          slippagePct: 1,
          tokenIn: '0xa',
          tokenOut: '0xb',
          executionAddress: '0xc',
          swapTx,
        },
        now: now + 1_000,
      }),
    ).toBe(true)
    expect(
      canFastCanonicalZoraSubmit({
        executionMode: 'canonical',
        prep: buildZoraExecutePrepSnapshot({
          amountIn: '1000000',
          slippagePct: 1,
          tokenIn: '0xa',
          tokenOut: '0xb',
          executionAddress: '0xc',
          swapTx,
        }),
        quoteIsZora: true,
        matchParams: {
          amountIn: '1000000',
          slippagePct: 1,
          tokenIn: '0xa',
          tokenOut: '0xb',
          executionAddress: '0xc',
          swapTx,
        },
        now: now + 1_000,
      }),
    ).toBe(false)
  })

  it('skips submit refresh when calldata and router validation still fresh', () => {
    const now = 1_700_000_000_000
    const prep = buildZoraExecutePrepSnapshot({
      amountIn: '1000000',
      slippagePct: 1,
      tokenIn: '0xa',
      tokenOut: '0xb',
      executionAddress: '0xc',
      swapTx,
      routerValidated: true,
    })
    prep.preparedAt = now
    prep.routerValidatedAt = now
    expect(
      needsZoraSubmitRefresh(prep, {
        amountIn: '1000000',
        slippagePct: 1,
        tokenIn: '0xa',
        tokenOut: '0xb',
        executionAddress: '0xc',
        swapTx,
        now: now + 5_000,
      }),
    ).toBe(false)
    expect(isZoraRouterValidationFresh(prep, now + ZORA_EXECUTE_PREP_TTL_MS + 1)).toBe(false)
  })

  it('rejects prep when swap data prefix changes', () => {
    const prep = buildZoraExecutePrepSnapshot({
      amountIn: '1000000',
      slippagePct: 1,
      tokenIn: '0xa',
      tokenOut: '0xb',
      executionAddress: '0xc',
      swapTx,
    })
    expect(
      isZoraExecutePrepCalldataMatch(prep, {
        amountIn: '1000000',
        slippagePct: 1,
        tokenIn: '0xa',
        tokenOut: '0xb',
        executionAddress: '0xc',
        swapTx: { ...swapTx, data: '0xdeadbeef' },
      }),
    ).toBe(false)
    expect(fingerprintSwapTxData(swapTx)).toBe('0x24856bc300000000')
  })
})
