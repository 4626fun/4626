import { describe, expect, it } from 'vitest'

import { assertBootstrapSwapPlanReady, buildBootstrapSwapUnavailableMessage } from './bootstrapSwapGate'

describe('bootstrapSwapGate', () => {
  it('does not throw when swap route is present', () => {
    expect(() =>
      assertBootstrapSwapPlanReady({
        hasSwap: true,
        providerRequested: 'defillama',
        providerUsed: 'defillama',
        fallbackUsed: false,
        swapError: null,
      }),
    ).not.toThrow()
  })

  it('builds actionable error details when route is missing', () => {
    const message = buildBootstrapSwapUnavailableMessage({
      hasSwap: false,
      providerRequested: 'defillama',
      providerUsed: null,
      fallbackUsed: true,
      swapError: 'No bootstrap swap route available',
    })
    expect(message).toContain('Bootstrap USDC swap route unavailable')
    expect(message).toContain('defillama')
    expect(message).toContain('No bootstrap swap route available')
  })

  it('throws when swap route is missing', () => {
    expect(() =>
      assertBootstrapSwapPlanReady({
        hasSwap: false,
        providerRequested: '0x',
        providerUsed: null,
        fallbackUsed: false,
        swapError: 'upstream down',
      }),
    ).toThrow(/bootstrap usdc swap route unavailable/i)
  })
})
