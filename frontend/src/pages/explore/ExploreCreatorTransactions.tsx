import { Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExplorePlaceholderPage } from '@/components/explore/ExplorePlaceholderPage'
import { isSupportedExploreChain } from '@/features/explore/exploreShared'

export function ExploreCreatorTransactions() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()
  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  if (!chain || !isSupportedExploreChain(chain) || !tokenAddress) {
    return <Navigate replace to="/explore/transactions" />
  }

  return (
    <ExplorePlaceholderPage
      sectionLabel="Transactions"
      heading="Creator Coin"
      identifier={tokenAddress}
      subnavSearchPlaceholder="Filter transactions…"
      cardLabel="Coming soon"
      cardDescription="This page will show swaps/mints/launch events for this creator coin."
      actions={[
        {
          to: `/explore/creators/base/${tokenAddress}`,
          label: 'Back to creator',
        },
      ]}
      meta={{
        title: 'Creator Transactions',
        description: 'View on-chain transactions for this creator coin on 4626.',
        canonicalPath: `/explore/transactions/${String(params.chain ?? '')}/${String(params.tokenAddress ?? '')}`,
      }}
    />
  )
}
