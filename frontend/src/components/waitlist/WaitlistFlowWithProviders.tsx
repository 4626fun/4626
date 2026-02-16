import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'
import { WaitlistFlow } from './WaitlistFlow'
import type { Variant } from './waitlistTypes'

export default function WaitlistFlowWithProviders(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  return (
    <PrivyClientProvider>
      <Web3Providers>
        <WaitlistFlow variant={variant} sectionId={sectionId} />
      </Web3Providers>
    </PrivyClientProvider>
  )
}
