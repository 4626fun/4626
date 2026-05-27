import { getAddress, isAddress } from 'viem'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import { normalizeCoinSearchQuery } from '@/features/explore/exploreShared'
import { fetchZoraCoin, fetchZoraProfile, fetchZoraProfileCoins } from '@/lib/zora/client'
import type { ZoraCoin } from '@/lib/zora/types'
import { BASE_CHAIN_ID } from '@/lib/uniswap/swapUtils'

import {
  enrichSwapTokenOptions,
  isAddressLikeSwapSymbol,
  isOpaqueInternalTokenLabel,
  resolveCreatorCoinLabelsFromZora,
} from './swapTokenLabels'

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const MIN_ZORA_SEARCH_QUERY_LENGTH = 2

function buildProfileIdentifierCandidates(query: string): string[] {
  const normalized = normalizeCoinSearchQuery(query)
  const base = normalized.withoutAt
  if (!base) return []

  const candidates: string[] = []
  const pushUnique = (value: string) => {
    if (!value || candidates.includes(value)) return
    candidates.push(value)
  }

  pushUnique(base)
  if (base.endsWith('.base.eth')) {
    pushUnique(base.slice(0, -'.base.eth'.length))
  } else if (!base.includes('.')) {
    pushUnique(`${base}.base.eth`)
  }
  return candidates
}

function dedupeCoinsByAddress(coins: ZoraCoin[]): ZoraCoin[] {
  const out: ZoraCoin[] = []
  const seen = new Set<string>()
  for (const coin of coins) {
    const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
    if (!address || seen.has(address)) continue
    seen.add(address)
    out.push(coin)
  }
  return out
}

export function normalizeSwapTokenSearchQuery(query: string): string {
  return normalizeCoinSearchQuery(query).withoutAt
}

export function shouldRunZoraSwapTokenSearch(query: string): boolean {
  const normalized = normalizeSwapTokenSearchQuery(query)
  if (!normalized) return false
  if (ADDRESS_REGEX.test(normalized)) return true
  return normalized.length >= MIN_ZORA_SEARCH_QUERY_LENGTH
}

export async function searchZoraCreatorCoinsForSwap(query: string): Promise<ZoraCoin[]> {
  const trimmed = query.trim()
  if (!trimmed || !shouldRunZoraSwapTokenSearch(trimmed)) return []

  const results: ZoraCoin[] = []
  const addCoin = (coin: ZoraCoin | null | undefined) => {
    if (!coin) return
    results.push(coin)
  }

  if (ADDRESS_REGEX.test(trimmed)) {
    try {
      const directCoin = await fetchZoraCoin(trimmed as `0x${string}`, BASE_CHAIN_ID)
      addCoin(directCoin)
    } catch {
      // Best-effort direct address lookup; continue with profile search.
    }
  }

  const profileCandidates = buildProfileIdentifierCandidates(trimmed)
  for (const identifier of profileCandidates) {
    let profile: Awaited<ReturnType<typeof fetchZoraProfile>> | null = null
    try {
      profile = await fetchZoraProfile(identifier)
    } catch {
      profile = null
    }
    if (!profile) continue

    const creatorCoinAddress =
      typeof profile.creatorCoin?.address === 'string' ? profile.creatorCoin.address : null
    if (creatorCoinAddress && ADDRESS_REGEX.test(creatorCoinAddress)) {
      try {
        const creatorCoin = await fetchZoraCoin(creatorCoinAddress as `0x${string}`, BASE_CHAIN_ID)
        addCoin(creatorCoin)
      } catch {
        // keep going; fallback to createdCoins below
      }
    }

    const profileEdges = Array.isArray(profile.createdCoins?.edges) ? profile.createdCoins.edges : []
    for (const edge of profileEdges) {
      addCoin(edge?.node as ZoraCoin | undefined)
    }

    if (creatorCoinAddress || profileEdges.length > 0) continue

    try {
      const profileWithCoins = await fetchZoraProfileCoins({ identifier, count: 8 })
      const profileCoinsEdges = Array.isArray(profileWithCoins?.createdCoins?.edges)
        ? profileWithCoins.createdCoins.edges
        : []
      for (const edge of profileCoinsEdges) {
        addCoin(edge?.node as ZoraCoin | undefined)
      }
    } catch {
      // ignore profile coin expansion errors
    }
  }

  return dedupeCoinsByAddress(results)
}

export function zoraCoinToSwapTokenOption(coin: ZoraCoin, chainId: number = BASE_CHAIN_ID): SwapTokenOption | null {
  const address = typeof coin.address === 'string' ? coin.address.trim() : ''
  if (!address || !isAddress(address)) return null

  const checksummed = getAddress(address)
  const coinType = String(coin.coinType ?? '').toUpperCase()
  const { symbol, name } =
    coinType === 'CONTENT'
      ? {
          symbol: (coin.symbol || '').trim() || 'TOKEN',
          name: (coin.name || coin.symbol || 'Content coin').trim(),
        }
      : resolveCreatorCoinLabelsFromZora(coin, checksummed)
  const logoUrl = coin.mediaContent?.previewImage?.medium ?? coin.mediaContent?.previewImage?.small ?? undefined

  const group = coinType === 'CONTENT' ? ('share' as const) : ('creator' as const)
  return {
    address: getAddress(address),
    symbol,
    name,
    group,
    chainId,
    verified: true,
    sectionTag: group === 'creator' ? 'creator' : 'content',
    logoUrl,
    logoUrls: logoUrl ? [logoUrl] : undefined,
  }
}

export function zoraCoinsToSwapTokenOptions(coins: ZoraCoin[], chainId: number = BASE_CHAIN_ID): SwapTokenOption[] {
  const out: SwapTokenOption[] = []
  const seen = new Set<string>()
  for (const coin of coins) {
    const option = zoraCoinToSwapTokenOption(coin, chainId)
    if (!option) continue
    const key = option.address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(option)
  }
  return out
}

export async function enrichDiscoveredSwapTokenOptions(options: SwapTokenOption[]): Promise<SwapTokenOption[]> {
  if (options.length === 0) return options
  return enrichSwapTokenOptions(options)
}
