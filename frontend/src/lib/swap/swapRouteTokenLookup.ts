import { getAddress, isAddress } from 'viem'

import { CONTRACTS } from '@/config/contracts'
import type { SwapRouteLeg } from '@/lib/swap/swapQuoteDetails'
import { uniswapBaseLogo } from '@/lib/uniswap/swapUtils'

export type SwapRouteTokenMeta = {
  symbol: string
  address: `0x${string}` | null
  imageUrl?: string | null
}

function routeTokenKey(symbol: string): string {
  return symbol.trim().toLowerCase()
}

function normalizeRouteAddress(address: string | null | undefined): `0x${string}` | null {
  const trimmed = typeof address === 'string' ? address.trim() : ''
  if (!trimmed || !isAddress(trimmed)) return null
  return getAddress(trimmed)
}

/** Best-effort Base mainnet address for common hop symbols when the quote omits them. */
export function resolveKnownBaseRouteTokenAddress(symbol: string): `0x${string}` | null {
  switch (symbol.trim().toUpperCase()) {
    case 'ETH':
    case 'WETH':
      return CONTRACTS.weth
    case 'USDC':
      return CONTRACTS.usdc
    case 'ZORA':
      return CONTRACTS.zora
    default:
      return null
  }
}

/** Curated logo for common hop symbols — avoids premium renderer chips on route popovers. */
export function resolveKnownBaseRouteTokenImageUrl(symbol: string): string | null {
  const address = resolveKnownBaseRouteTokenAddress(symbol)
  if (!address) return null
  return uniswapBaseLogo(address)
}

export function buildSwapRouteTokenLookup(params: {
  tokenInSymbol: string
  tokenInAddress: string
  tokenInLogoUrl?: string | null
  tokenOutSymbol: string
  tokenOutAddress: string
  tokenOutLogoUrl?: string | null
  routeLegs?: SwapRouteLeg[]
}): Record<string, SwapRouteTokenMeta> {
  const lookup: Record<string, SwapRouteTokenMeta> = {}

  const upsert = (symbol: string, address?: string | null, imageUrl?: string | null) => {
    const trimmedSymbol = symbol.trim()
    if (!trimmedSymbol) return
    const key = routeTokenKey(trimmedSymbol)
    const existing = lookup[key]
    const resolvedAddress =
      normalizeRouteAddress(address) ??
      existing?.address ??
      resolveKnownBaseRouteTokenAddress(trimmedSymbol)

    lookup[key] = {
      symbol: trimmedSymbol,
      address: resolvedAddress,
      imageUrl:
        imageUrl ??
        existing?.imageUrl ??
        resolveKnownBaseRouteTokenImageUrl(trimmedSymbol),
    }
  }

  upsert(params.tokenInSymbol, params.tokenInAddress, params.tokenInLogoUrl)
  upsert(params.tokenOutSymbol, params.tokenOutAddress, params.tokenOutLogoUrl)

  for (const leg of params.routeLegs ?? []) {
    upsert(leg.tokenIn, leg.tokenInAddress, null)
    upsert(leg.tokenOut, leg.tokenOutAddress, null)
  }

  return lookup
}

export function resolveSwapRouteTokenMeta(
  lookup: Record<string, SwapRouteTokenMeta>,
  symbol: string,
): SwapRouteTokenMeta {
  const trimmedSymbol = symbol.trim()
  const existing = lookup[routeTokenKey(trimmedSymbol)]
  if (existing) return existing

  return {
    symbol: trimmedSymbol,
    address: resolveKnownBaseRouteTokenAddress(trimmedSymbol),
    imageUrl: resolveKnownBaseRouteTokenImageUrl(trimmedSymbol),
  }
}
