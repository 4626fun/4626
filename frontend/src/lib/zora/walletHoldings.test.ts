// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchWalletZoraHoldings,
  ZORA_HOLDINGS_MAX_TOP_TOKENS,
} from './walletHoldings'

describe('fetchWalletZoraHoldings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('forwards topTokens up to the raised max and pins extraTokenAddresses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      expect(url).toContain('topTokens=200')
      expect(url).toContain('extraTokens=0x1111111111111111111111111111111111111111')
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            wallet: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
            asOf: 1,
            portfolioSource: 'debank',
            creator: [],
            content: [],
            trend: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(ZORA_HOLDINGS_MAX_TOP_TOKENS).toBe(200)

    await fetchWalletZoraHoldings({
      wallet: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      topTokenCount: 500,
      extraTokenAddresses: ['0x1111111111111111111111111111111111111111'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
