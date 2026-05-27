import { useQuery } from '@tanstack/react-query'

import { collectSwapTokenPriceLookups, type SwapUsdPriceContext } from '@/lib/swap/swapAmountUsd'

const DEFILLAMA_PRICE_BASE = 'https://coins.llama.fi/prices/current'

async function fetchEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(`${DEFILLAMA_PRICE_BASE}/coingecko:ethereum`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { coins?: Record<string, { price?: number }> }
    const price = data.coins?.['coingecko:ethereum']?.price
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : 0
  } catch {
    return 0
  }
}

async function fetchBaseTokenUsdPrices(contractAddresses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const uniq = Array.from(
    new Set(contractAddresses.map((a) => a.toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a))),
  )
  if (uniq.length === 0) return out

  const chunkSize = 40
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const slice = uniq.slice(i, i + chunkSize)
    const path = slice.map((addr) => `base:${addr}`).join(',')
    try {
      const res = await fetch(`${DEFILLAMA_PRICE_BASE}/${path}`, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue
      const data = (await res.json()) as { coins?: Record<string, { price?: number; address?: string }> }
      for (const [key, coin] of Object.entries(data.coins ?? {})) {
        const price = coin?.price
        if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue
        const addr = (coin?.address ?? key.replace(/^base:/, '')).toLowerCase()
        if (addr) out.set(addr, price)
      }
    } catch {
      continue
    }
  }
  return out
}

export function useSwapTokenUsdPrices(tokenIn: string, tokenOut: string): {
  prices: SwapUsdPriceContext
  isLoading: boolean
} {
  const tokenLookups = collectSwapTokenPriceLookups(tokenIn, tokenOut)

  const query = useQuery({
    queryKey: ['swap-token-usd-prices', tokenLookups.join(',')],
    staleTime: 30_000,
    gcTime: 120_000,
    queryFn: async () => {
      const [ethUsd, tokenUsdByAddress] = await Promise.all([
        fetchEthUsdPrice(),
        fetchBaseTokenUsdPrices(tokenLookups),
      ])
      return { ethUsd, tokenUsdByAddress }
    },
  })

  return {
    prices: {
      ethUsd: query.data?.ethUsd ?? 0,
      tokenUsdByAddress: query.data?.tokenUsdByAddress ?? new Map(),
    },
    isLoading: query.isLoading || query.isFetching,
  }
}
