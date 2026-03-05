import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'
import { ThinWaitlistFlow } from './ThinWaitlistFlow'
import type { Variant } from './waitlistTypes'

export default function WaitlistFlowWithProviders(props: { variant?: Variant; sectionId?: string; onClose?: () => void }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  return (
    <PrivyClientProvider>
      <Web3Providers>
        <ThinWaitlistFlow variant={variant} sectionId={sectionId} onClose={props.onClose} />
      </Web3Providers>
    </PrivyClientProvider>
  )
}
