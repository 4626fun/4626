import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'
import { WaitlistFlow } from './WaitlistFlow'

export default function WaitlistFlowWithProviders() {
  return (
    <PrivyClientProvider>
      <Web3Providers>
        <WaitlistFlow variant="embedded" sectionId="waitlist" />
      </Web3Providers>
    </PrivyClientProvider>
  )
}
