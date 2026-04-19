import type { Address } from 'viem'

import { useZoraCoin } from '@/lib/zora/hooks'

/**
 * Thin adapter over `useZoraCoin` that returns just the fields the
 * identity card + accounts hero need to display a creator coin badge.
 * Returns `null` when the address isn't a known Zora coin or the
 * profile doesn't have enough data to render a meaningful badge — the
 * consumer omits the badge entirely in that case (see
 * `docs/design/identity-surface-spec.md` § "Creator coin chip").
 */

export type CreatorCoinBadge = {
  address: Address
  symbol: string | null
  name: string | null
  /** Best-available logo URL (small square), or null if none. */
  logoUrl: string | null
  /** USD price per coin, stringified, or null if unknown. */
  priceUsd: string | null
  /** Market cap in USD, stringified, or null. */
  marketCapUsd: string | null
  loading: boolean
}

function pickLogoUrl(coin: unknown): string | null {
  if (!coin || typeof coin !== 'object') return null
  const media = (coin as { mediaContent?: any }).mediaContent
  if (!media || typeof media !== 'object') return null
  const preview = media.previewImage
  if (preview && typeof preview === 'object') {
    if (typeof preview.small === 'string' && preview.small.length > 0) return preview.small
    if (typeof preview.medium === 'string' && preview.medium.length > 0) return preview.medium
    if (typeof preview.blurhash === 'string') return null // just the hash, not a URL
  }
  if (typeof media.originalUri === 'string' && media.originalUri.length > 0) return media.originalUri
  return null
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function useCreatorCoinBadge(address?: Address | null): CreatorCoinBadge | null {
  const query = useZoraCoin(address ?? undefined)
  if (!address) return null
  if (query.isLoading) {
    return {
      address,
      symbol: null,
      name: null,
      logoUrl: null,
      priceUsd: null,
      marketCapUsd: null,
      loading: true,
    }
  }
  const coin = query.data
  if (!coin) return null

  const symbol = pickString((coin as any).symbol)
  const name = pickString((coin as any).name)
  const logoUrl = pickLogoUrl(coin)

  // Per spec: omit the badge when neither a symbol NOR a logo resolved.
  // A coin with only a name and no ticker/icon is not useful to show.
  if (!symbol && !logoUrl) return null

  const priceObj = (coin as any).tokenPrice
  const priceUsd =
    priceObj && typeof priceObj === 'object'
      ? pickString(priceObj.priceInUsdc) ?? pickString(priceObj.priceInUsd)
      : null

  return {
    address,
    symbol,
    name,
    logoUrl,
    priceUsd,
    marketCapUsd: pickString((coin as any).marketCap),
    loading: false,
  }
}
