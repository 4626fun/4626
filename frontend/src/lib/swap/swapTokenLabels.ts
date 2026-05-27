import { createPublicClient, erc20Abi, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import { fetchZoraCoin } from '@/lib/zora/client'
import { BASE_CHAIN_ID, creatorCoinRawLogo, shortAddress } from '@/lib/uniswap/swapUtils'

import type { ZoraCoin } from '@/lib/zora/types'

function formatCreatorHandleLabel(handle: string): string {
  const cleaned = handle.trim().replace(/^@/, '')
  if (!cleaned) return ''
  if (/^[A-Z0-9_]+$/.test(cleaned)) return cleaned
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function resolveCreatorCoinLabelsFromZora(
  coin: ZoraCoin,
  address: Address,
): { symbol: string; name: string } {
  const rawSymbol = (coin.symbol || '').trim()
  const rawName = (coin.name || '').trim()
  const handle = formatCreatorHandleLabel(coin.creatorProfile?.handle || coin.creatorProfile?.username || '')

  if (!isOpaqueInternalTokenLabel(rawSymbol) && !isAddressLikeSwapSymbol(rawSymbol, address)) {
    const name = !isOpaqueInternalTokenLabel(rawName) && rawName ? rawName : handle || rawSymbol || 'Creator coin'
    return { symbol: rawSymbol, name }
  }

  if (handle) {
    return {
      symbol: handle,
      name: !isOpaqueInternalTokenLabel(rawName) ? rawName : 'Creator coin',
    }
  }

  if (!isOpaqueInternalTokenLabel(rawName) && !isAddressLikeSwapSymbol(rawName, address)) {
    return { symbol: rawName, name: 'Creator coin' }
  }

  return { symbol: shortAddress(address), name: 'Creator coin' }
}

/** Vault/XMTP group ids and other opaque ids must not be shown as token symbols. */
export function isOpaqueInternalTokenLabel(value: string | undefined): boolean {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return true
  if (isAddress(trimmed)) return false
  // Long lowercase hex without 0x (e.g. ed6fbda34f2614536df5cec08dff2266)
  if (/^[a-f0-9]{20,}$/i.test(trimmed)) return true
  return false
}

/** Truncated or full addresses used as placeholders should be replaced with real labels. */
export function isAddressLikeSwapSymbol(symbol: string | undefined, address: string): boolean {
  const trimmed = String(symbol ?? '').trim()
  if (!trimmed) return true
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return true
  if (/^0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}$/i.test(trimmed)) return true
  if (!isAddress(address)) return false
  try {
    const checksummed = getAddress(address)
    if (isAddress(trimmed) && getAddress(trimmed).toLowerCase() === checksummed.toLowerCase()) return true
    return shortAddress(checksummed).toLowerCase() === trimmed.toLowerCase()
  } catch {
    return false
  }
}

export function swapTokenOptionNeedsLabelEnrichment(option: SwapTokenOption): boolean {
  if (option.group === 'core') return false
  return (
    isOpaqueInternalTokenLabel(option.symbol) ||
    isOpaqueInternalTokenLabel(option.name) ||
    isAddressLikeSwapSymbol(option.symbol, option.address)
  )
}

let basePublicClient: ReturnType<typeof createPublicClient> | null = null

function getBasePublicClient() {
  if (!basePublicClient) {
    basePublicClient = createPublicClient({ chain: base, transport: http() })
  }
  return basePublicClient
}

export async function resolveSwapTokenLabels(
  address: Address,
  chainId: number = BASE_CHAIN_ID,
): Promise<{ symbol: string; name: string; logoUrl?: string }> {
  const checksummed = getAddress(address)

  try {
    const coin = await fetchZoraCoin(checksummed, chainId)
    if (coin) {
      const labels = resolveCreatorCoinLabelsFromZora(coin, checksummed)
      if (!isAddressLikeSwapSymbol(labels.symbol, checksummed)) {
        const logoUrl =
          coin.mediaContent?.previewImage?.medium ?? coin.mediaContent?.previewImage?.small ?? undefined
        return {
          symbol: labels.symbol,
          name: labels.name,
          logoUrl,
        }
      }
    }
  } catch {
    // fall through to on-chain reads
  }

  if (chainId === BASE_CHAIN_ID) {
    try {
      const client = getBasePublicClient()
      const [nameRaw, symbolRaw] = await Promise.all([
        client.readContract({ address: checksummed, abi: erc20Abi, functionName: 'name' }).catch(() => null),
        client.readContract({ address: checksummed, abi: erc20Abi, functionName: 'symbol' }).catch(() => null),
      ])
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
      const symbol = typeof symbolRaw === 'string' ? symbolRaw.trim() : ''
      if (symbol && !isOpaqueInternalTokenLabel(symbol) && !isAddressLikeSwapSymbol(symbol, checksummed)) {
        const displaySymbol = symbol
        const displayName =
          name && !isOpaqueInternalTokenLabel(name) && name.toLowerCase() !== symbol.toLowerCase()
            ? name
            : 'Creator coin'
        return {
          symbol: displaySymbol,
          name: displayName,
          logoUrl: creatorCoinRawLogo(checksummed, chainId),
        }
      }
      if (name && !isOpaqueInternalTokenLabel(name) && !isAddressLikeSwapSymbol(name, checksummed)) {
        return {
          symbol: name,
          name: 'Creator coin',
          logoUrl: creatorCoinRawLogo(checksummed, chainId),
        }
      }
    } catch {
      // fall through to address fallback
    }
  }

  const short = shortAddress(checksummed)
  return { symbol: short, name: 'Creator coin', logoUrl: creatorCoinRawLogo(checksummed, chainId) }
}

export async function enrichSwapTokenOption(option: SwapTokenOption): Promise<SwapTokenOption> {
  if (!isAddress(option.address)) return option
  if (!swapTokenOptionNeedsLabelEnrichment(option)) {
    return option
  }

  const chainId = option.chainId ?? BASE_CHAIN_ID
  const checksummed = getAddress(option.address)

  try {
    const coin = await fetchZoraCoin(checksummed, chainId)
    if (coin) {
      const coinType = String(coin.coinType ?? '').toUpperCase()
      const group = coinType === 'CONTENT' ? ('share' as const) : ('creator' as const)
      const { symbol, name } =
        coinType === 'CONTENT'
          ? {
              symbol: (coin.symbol || '').trim() || 'TOKEN',
              name: (coin.name || coin.symbol || 'Content coin').trim(),
            }
          : resolveCreatorCoinLabelsFromZora(coin, checksummed)
      const logoUrl =
        coin.mediaContent?.previewImage?.medium ?? coin.mediaContent?.previewImage?.small ?? undefined
      if (!isAddressLikeSwapSymbol(symbol, checksummed)) {
        return {
          ...option,
          symbol,
          name,
          group,
          chainId,
          verified: true,
          sectionTag: group === 'creator' ? 'creator' : 'content',
          logoUrl: option.logoUrl ?? logoUrl,
          logoUrls: option.logoUrls ?? (logoUrl ? [logoUrl] : undefined),
        }
      }
    }
  } catch {
    // fall through to on-chain / address fallback
  }

  const labels = await resolveSwapTokenLabels(checksummed, chainId)
  const group =
    option.group === 'share' && !isAddressLikeSwapSymbol(labels.symbol, checksummed) ? 'creator' : option.group
  return {
    ...option,
    symbol: labels.symbol,
    name: labels.name,
    group,
    logoUrl: option.logoUrl ?? labels.logoUrl,
    logoUrls: option.logoUrls ?? (labels.logoUrl ? [labels.logoUrl] : undefined),
    verified: option.verified ?? true,
    sectionTag: group === 'creator' ? 'creator' : group === 'share' ? 'content' : option.sectionTag,
  }
}

export async function enrichSwapTokenOptions(options: SwapTokenOption[]): Promise<SwapTokenOption[]> {
  return Promise.all(options.map((option) => enrichSwapTokenOption(option)))
}
