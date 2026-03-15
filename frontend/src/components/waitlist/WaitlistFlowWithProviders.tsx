import { PrivyClientProvider } from '@/lib/privy/client'
import { ThinWaitlistFlow } from './ThinWaitlistFlow'
import type { Variant } from './waitlistTypes'

export default function WaitlistFlowWithProviders(props: { variant?: Variant; sectionId?: string }) {
  const variant = props.variant ?? 'embedded'
  const sectionId = props.sectionId ?? 'waitlist'

  return (
    <PrivyClientProvider showWalletLoginFirst={false}>
      <ThinWaitlistFlow variant={variant} sectionId={sectionId} />
    </PrivyClientProvider>
  )
}
