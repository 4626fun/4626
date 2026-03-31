import { Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExplorePlaceholderPage } from '@/components/explore/ExplorePlaceholderPage'
import { isSupportedExploreChain } from './exploreShared'

export function ExploreContentPoolAlias() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const poolIdOrPoolKeyHashRaw = String(params.poolIdOrPoolKeyHash ?? '').trim()

  if (!chain || !isSupportedExploreChain(chain)) {
    return <Navigate replace to="/explore/content" />
  }

  // Phase 1 behavior:
  // - If the segment is actually a content coin address, canonicalize to the coin route.
  // - Otherwise show a placeholder (pool-key resolution comes in Phase 3).
  if (isAddress(poolIdOrPoolKeyHashRaw)) {
    const contentCoinAddress = getAddress(poolIdOrPoolKeyHashRaw)
    return <Navigate replace to={`/explore/content/${chain.toLowerCase()}/${contentCoinAddress.toLowerCase()}`} />
  }

  return (
    <ExplorePlaceholderPage
      sectionLabel="Content market"
      heading="Pool key alias"
      headerNote="This URL is reserved for pool-key-based addressing. We’ll resolve it to a canonical content coin address once we wire Zora pool keys / onchain events."
      identifier={poolIdOrPoolKeyHashRaw}
      subnavSearchPlaceholder="Search content markets…"
      cardLabel="Next steps"
      cardDescription="For now, use the canonical market URL by content coin address."
      actions={[
        {
          to: '/explore/content',
          label: 'Browse content markets',
          tone: 'accent',
        },
        {
          to: '/explore/creators',
          label: 'Browse creators',
          tone: 'primary',
        },
      ]}
    />
  )
}
