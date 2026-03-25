import { WalletProviders } from '@/web3/Web3Providers'

import StatusFixPanel from './StatusFixPanel'
import type { ResolvedStatusFixContext } from './statusShared'

export default function StatusFixPanelWithProviders(props: {
  context: ResolvedStatusFixContext
  onApplied: () => void
}) {
  return (
    <WalletProviders>
      <StatusFixPanel {...props} />
    </WalletProviders>
  )
}
