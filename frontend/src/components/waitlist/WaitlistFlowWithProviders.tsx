import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'
import { ThinWaitlistFlow } from './ThinWaitlistFlow'
import type { Variant } from './waitlistTypes'

export default function WaitlistFlowWithProviders(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  return (
    <Web3Providers>
      <PrivyClientProvider showWalletLoginFirst={false}>
        <ThinWaitlistFlow variant={variant} sectionId={sectionId} />
      </PrivyClientProvider>
    </Web3Providers>
  )
}
