import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { isOpaqueInternalTokenLabel } from '@/lib/swap/swapTokenLabels'
import {
  enrichDiscoveredSwapTokenOptions,
  normalizeSwapTokenSearchQuery,
} from '@/lib/swap/zoraTokenSearch'
import { fetchSwapZoraHoldings, type SwapZoraHoldingRow } from './swapZoraHoldings'
import {
  enrichSwapTokenOption,
  resolveSwapTokenVerified,
  swapTokenOptionNeedsLabelEnrichment,
} from '@/lib/swap/swapTokenLabels'
import {
  BASE_CHAIN_ID,
  buildTokenOptions,
  getCoreTokensForChain,
  NATIVE_TOKEN_ADDRESS,
  shortAddress,
  tokenLogoFallbacks,
  uniswapBaseLogo,
  type TokenOption,
} from '@/lib/uniswap/swapUtils'
import { CONTRACTS } from '@/config/contracts'
import { ZORA_TOKEN_LOGO_URL } from '@/lib/tokens/tokenLogo'
import { getChainMeta, type SupportedChainId } from '@/config/chains'

const CORE_TOKENS: TokenOption[] = [
  // Represent ETH as native for Uniswap Trading API + wagmi balances.
  // Keep ETH logo mapped to WETH assets while preserving native address execution.
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: NATIVE_TOKEN_ADDRESS,
    group: 'core',
    logoUrl: uniswapBaseLogo(CONTRACTS.weth),
    logoUrls: tokenLogoFallbacks(CONTRACTS.weth),
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: CONTRACTS.usdc,
    group: 'core',
    logoUrl: uniswapBaseLogo(CONTRACTS.usdc),
    logoUrls: tokenLogoFallbacks(CONTRACTS.usdc),
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' as `0x${string}`,
    group: 'core',
    logoUrl: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
    logoUrls: [
      'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
      ...tokenLogoFallbacks('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' as `0x${string}`),
    ],
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as `0x${string}`,
    group: 'core',
    logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    logoUrls: [
      'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      ...tokenLogoFallbacks('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as `0x${string}`),
    ],
  },
  {
    symbol: 'ZORA',
    name: 'Zora',
    address: CONTRACTS.zora,
    group: 'core',
    logoUrl: ZORA_TOKEN_LOGO_URL,
    logoUrls: [ZORA_TOKEN_LOGO_URL],
  },
]

const EMPTY_SWAP_TOKEN_OPTIONS: SwapTokenOption[] = []

type ExploreSwapTokenRow = {
  chainId: number
  creatorCoinAddress: `0x${string}` | null
  groupId: string
}

type ExploreSwapTokenResponse = {
  items: ExploreSwapTokenRow[]
}

function normalizeCreatorCoinLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

async function fetchSwapVaultCreatorCoinOptions(params: {
  query: string
  limit: number
  chainId: number
}): Promise<SwapTokenOption[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(params.limit))
  searchParams.set('sort', 'volume')
  searchParams.set('time', '1y')
  searchParams.set('chainId', String(params.chainId))
  const query = normalizeSwapTokenSearchQuery(params.query)
  if (query) searchParams.set('query', query)

  const res = await apiFetch(`${API_ENDPOINTS.explore.vaults}?${searchParams.toString()}`, { method: 'GET' })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreSwapTokenResponse> | null
  if (!res.ok || !json?.success || !json.data || !Array.isArray(json.data.items)) return []

  const out: SwapTokenOption[] = []
  const seen = new Set<string>()
  for (const item of json.data.items) {
    const creatorCoinAddress = item?.creatorCoinAddress
    if (!creatorCoinAddress || !isAddress(creatorCoinAddress)) continue
    const normalizedAddress = getAddress(creatorCoinAddress).toLowerCase()
    if (seen.has(normalizedAddress)) continue
    seen.add(normalizedAddress)

    const groupLabel = normalizeCreatorCoinLabel(item?.groupId)
    const useGroupAsLabel = Boolean(groupLabel && !isOpaqueInternalTokenLabel(groupLabel))
    const symbol = useGroupAsLabel ? groupLabel! : shortAddress(normalizedAddress)
    out.push({
      address: normalizedAddress,
      symbol,
      name: useGroupAsLabel ? `${groupLabel} creator coin` : 'Creator coin',
      group: 'creator',
      chainId: params.chainId,
      verified: true,
    })
  }
  return out
}

async function fetchSwapCreatorCoinOptions(params: {
  query: string
  limit: number
  chainId: number
}): Promise<SwapTokenOption[]> {
  const normalizedQuery = normalizeSwapTokenSearchQuery(params.query)
  const vaultOptions = await fetchSwapVaultCreatorCoinOptions({ ...params, query: normalizedQuery })
  const sliced = vaultOptions.slice(0, params.limit)
  return enrichDiscoveredSwapTokenOptions(sliced)
}

export interface UseSwapTokenOptionsParams {
  swapChainId: number
  tokenIn: string
  tokenOut: string
  tokenSelectorOpen: boolean
  normalizedTokenSelectorQuery: string
  requestedTradeToken: string | null
  normalizedRequestedShareToken: string | null
  balanceOwnerAddress?: string | null
}

export interface UseSwapTokenOptionsResult {
  swapTokenOptions: SwapTokenOption[]
  tokenInOption: SwapTokenOption | null
  tokenOutOption: SwapTokenOption | null
  registerTokenForIdentity: (option: SwapTokenOption) => void
  discoveredCreatorTokenOptionsQuery: {
    isFetching: boolean
  }
  preferZoraTradeRoute: boolean
  /** USD value per held token (lowercased address), from the Zora wallet-holdings API. */
  holdingsUsdByAddress: Map<string, number>
}

export function useSwapTokenOptions(params: UseSwapTokenOptionsParams): UseSwapTokenOptionsResult {
  const {
    swapChainId,
    tokenIn,
    tokenOut,
    tokenSelectorOpen,
    normalizedTokenSelectorQuery,
    requestedTradeToken,
    normalizedRequestedShareToken,
    balanceOwnerAddress,
  } = params

  const [extraTokenOptions, setExtraTokenOptions] = useState<SwapTokenOption[]>([])

  // Fetch the user's personal Zora creator + content coin holdings for the balance owner
  // (canonical CSW or execution wallet). These are merged so the token selector shows
  // "my holdings" with balances.
  const userZoraHoldingsQuery = useQuery<SwapZoraHoldingRow[]>({
    queryKey: ['swap', 'zora-holdings', balanceOwnerAddress ?? '', swapChainId],
    enabled: Boolean(balanceOwnerAddress && swapChainId === BASE_CHAIN_ID),
    staleTime: 60_000,
    queryFn: async () => {
      if (!balanceOwnerAddress) return []
      return await fetchSwapZoraHoldings(balanceOwnerAddress)
    },
  })

  const userHoldingsOptions = useMemo<SwapTokenOption[]>(() => {
    const rows = userZoraHoldingsQuery.data ?? []
    return rows.map((row) => ({
      ...row.option,
      isUserHolding: true,
    }))
  }, [userZoraHoldingsQuery.data])

  const holdingsUsdByAddress = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of userZoraHoldingsQuery.data ?? []) {
      if (typeof row.usdValue === 'number' && Number.isFinite(row.usdValue)) {
        map.set(row.option.address.toLowerCase(), row.usdValue)
      }
    }
    return map
  }, [userZoraHoldingsQuery.data])

  const discoveredCreatorTokenOptionsQuery = useQuery({
    queryKey: ['swap', 'creator-coin-options', swapChainId, normalizedTokenSelectorQuery],
    enabled: tokenSelectorOpen && swapChainId === BASE_CHAIN_ID,
    staleTime: 30_000,
    queryFn: async () => {
      return await fetchSwapCreatorCoinOptions({
        query: normalizedTokenSelectorQuery,
        chainId: BASE_CHAIN_ID,
        limit: 100,
      })
    },
  })
  const discoveredCreatorTokenOptions =
    discoveredCreatorTokenOptionsQuery.data ?? EMPTY_SWAP_TOKEN_OPTIONS

  const dynamicCoreTokens = useMemo(() => {
    if (swapChainId === BASE_CHAIN_ID) return CORE_TOKENS
    const meta = getChainMeta(swapChainId as SupportedChainId)
    if (!meta) return CORE_TOKENS
    return getCoreTokensForChain({
      chainId: meta.id,
      nativeSymbol: meta.nativeCurrency.symbol,
      nativeName: meta.nativeCurrency.name,
      weth: meta.weth,
      usdc: meta.usdc,
    })
  }, [swapChainId])

  const internalTokenOptions = useMemo<TokenOption[]>(() => {
    return buildTokenOptions({
      coreTokens: dynamicCoreTokens,
      creatorCoin: swapChainId === BASE_CHAIN_ID ? requestedTradeToken : '',
      shareCoin: swapChainId === BASE_CHAIN_ID ? normalizedRequestedShareToken : '',
      chainId: swapChainId,
    })
  }, [dynamicCoreTokens, normalizedRequestedShareToken, requestedTradeToken, swapChainId])

  const allTokenOptions = useMemo<SwapTokenOption[]>(() => {
    // Later entries win so curated options override address-only stubs.
    // Put userHoldings last so that if a holding address overlaps with discovered/core,
    // the holding entry (with isUserHolding flag and correct ownership) wins the dedupe.
    const merged = [
      ...extraTokenOptions,
      ...discoveredCreatorTokenOptions,
      ...internalTokenOptions,
      ...userHoldingsOptions,
    ]
    const byAddress = new Map<string, SwapTokenOption>()
    for (const option of merged) {
      byAddress.set(option.address.toLowerCase(), option)
    }
    return [...byAddress.values()]
  }, [discoveredCreatorTokenOptions, extraTokenOptions, internalTokenOptions, userHoldingsOptions])

  const opaqueSwapTokenOptions = useMemo(
    () => allTokenOptions.filter((option) => swapTokenOptionNeedsLabelEnrichment(option)),
    [allTokenOptions],
  )

  const enrichedOpaqueLabelsQuery = useQuery({
    queryKey: [
      'swap-opaque-token-labels',
      opaqueSwapTokenOptions.map((option) => `${option.address}:${option.symbol}:${option.name}`).join('|'),
    ],
    enabled: opaqueSwapTokenOptions.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        opaqueSwapTokenOptions.map(async (option) => {
          const enriched = await enrichSwapTokenOption(option)
          return [option.address.toLowerCase(), enriched] as const
        }),
      )
      return new Map(entries)
    },
  })

  const swapTokenOptions = useMemo<SwapTokenOption[]>(() => {
    const enrichedByAddress = enrichedOpaqueLabelsQuery.data
    return allTokenOptions.map((option) => {
      const enriched = enrichedByAddress?.get(option.address.toLowerCase())
      const resolved = enriched ?? option
      const result: SwapTokenOption = {
        ...resolved,
        verified: resolveSwapTokenVerified(resolved),
        sectionTag:
          resolved.group === 'creator' ? 'creator' : resolved.group === 'share' ? 'content' : undefined,
      }
      // Preserve isUserHolding so the selector can put personal Zora holdings
      // into the dedicated "Your holdings" section (enrichment can otherwise drop extra props).
      if ((option as any).isUserHolding) {
        (result as any).isUserHolding = true
      }
      return result
    })
  }, [allTokenOptions, enrichedOpaqueLabelsQuery.data])

  const tokenInOption = useMemo(
    () => swapTokenOptions.find((opt) => opt.address.toLowerCase() === tokenIn.toLowerCase()) ?? null,
    [tokenIn, swapTokenOptions],
  )
  const tokenOutOption = useMemo(
    () => swapTokenOptions.find((opt) => opt.address.toLowerCase() === tokenOut.toLowerCase()) ?? null,
    [tokenOut, swapTokenOptions],
  )

  const preferZoraTradeRoute = useMemo(
    () => tokenInOption?.group === 'creator' || tokenOutOption?.group === 'creator',
    [tokenInOption?.group, tokenOutOption?.group],
  )

  const registerTokenForIdentity = useCallback((option: SwapTokenOption) => {
    setExtraTokenOptions((previous) => {
      const normalized = option.address.toLowerCase()
      if (previous.some((entry) => entry.address.toLowerCase() === normalized)) return previous
      return [...previous, { ...option }]
    })
  }, [])

  return {
    swapTokenOptions,
    tokenInOption,
    tokenOutOption,
    registerTokenForIdentity,
    discoveredCreatorTokenOptionsQuery: {
      isFetching: discoveredCreatorTokenOptionsQuery.isFetching,
    },
    preferZoraTradeRoute,
    holdingsUsdByAddress,
  }
}
