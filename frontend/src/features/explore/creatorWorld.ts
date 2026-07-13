import type { ZoraCoin } from '@/lib/zora/types'

import { toDisplayAssetUrl } from '@/features/explore/exploreShared'

export const CREATOR_WORLD_MAX_ITEMS = 48

export type CreatorExploreView = 'table' | 'world'

export type CreatorWorldItem = {
  coin: ZoraCoin
  address: string
  detailPath: string
  imageUrl?: string
  name: string
  symbol: string
}

export function normalizeCreatorExploreView(value: string | null | undefined): CreatorExploreView {
  return value === 'world' ? 'world' : 'table'
}

export function resolveCreatorWorldImage(coin: ZoraCoin): string | undefined {
  return toDisplayAssetUrl(
    coin.creatorProfile?.avatar?.previewImage?.medium ??
      coin.creatorProfile?.avatar?.previewImage?.small ??
      coin.mediaContent?.previewImage?.medium ??
      coin.mediaContent?.previewImage?.small,
  )
}

export function buildCreatorWorldItems(
  coins: ZoraCoin[],
  limit = CREATOR_WORLD_MAX_ITEMS,
): CreatorWorldItem[] {
  const items: CreatorWorldItem[] = []
  const seen = new Set<string>()
  const safeLimit = Math.max(0, Math.floor(limit))

  for (const coin of coins) {
    const address = coin.address?.trim()
    if (!address) continue

    const normalizedAddress = address.toLowerCase()
    if (seen.has(normalizedAddress)) continue
    seen.add(normalizedAddress)

    items.push({
      coin,
      address,
      detailPath: `/explore/creators/base/${address}`,
      imageUrl: resolveCreatorWorldImage(coin),
      name: coin.name?.trim() || coin.symbol?.trim() || 'Unknown creator',
      symbol: coin.symbol?.trim() || '',
    })

    if (items.length >= safeLimit) break
  }

  return items
}
