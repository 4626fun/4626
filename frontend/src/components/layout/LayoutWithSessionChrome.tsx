import { useLocation } from 'react-router-dom'

import { useAccountTrayPortfolio } from '@/components/account/useAccountTrayPortfolio'
import { isMarketingWaitlistEntryLocation } from '@/lib/auth/waitlistEntry'
import { getHostMode } from '@/lib/env/host'
import { useSiweAuth } from '@/hooks/useSiweAuth'

import { LayoutFrame } from './Layout'

export function LayoutWithSessionChrome(props: { interactive?: boolean; chatEnabled?: boolean }) {
  const interactive = props.interactive ?? true
  const hostMode = getHostMode()
  const auth = useSiweAuth()
  const location = useLocation()
  const isWaitlistSurface = isMarketingWaitlistEntryLocation(location)
  const { trayHoldings, isLoading: mobileWalletLoading } = useAccountTrayPortfolio({
    enabled: interactive && hostMode === 'app' && !isWaitlistSurface,
  })
  const mobileWalletUsd = auth.hasSession ? trayHoldings.activeNetworkUsd : null

  return (
    <LayoutFrame
      {...props}
      sessionChrome={{
        hasSession: auth.hasSession,
        mobileWalletUsd,
        mobileWalletLoading,
      }}
    />
  )
}
