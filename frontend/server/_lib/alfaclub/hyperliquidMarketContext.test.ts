import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPerpMarketContext } from './hyperliquid.js'

describe('getPerpMarketContext', () => {
  afterEach(() => vi.restoreAllMocks())

  it('maps a symbol to current funding, USD OI, volume, and price change', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          { universe: [{ name: 'BTC' }, { name: 'ETH' }] },
          [
            { markPx: '100000', prevDayPx: '98000', funding: '0.0001', openInterest: '20', dayNtlVlm: '3000000' },
            { markPx: '4000', prevDayPx: '3800', funding: '-0.0002', openInterest: '500', dayNtlVlm: '1000000' },
          ],
        ]),
        { status: 200 },
      ),
    )

    await expect(getPerpMarketContext('eth')).resolves.toEqual({
      symbol: 'ETH',
      markPriceUsd: 4000,
      priceChange24hPct: expect.closeTo(5.263157, 5),
      fundingRate: -0.0002,
      openInterestUsd: 2_000_000,
      volume24hUsd: 1_000_000,
    })
  })

  it('fails closed for unknown symbols', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ universe: [{ name: 'BTC' }] }, [{}]]), { status: 200 }),
    )
    await expect(getPerpMarketContext('ETH')).resolves.toBeNull()
  })
})