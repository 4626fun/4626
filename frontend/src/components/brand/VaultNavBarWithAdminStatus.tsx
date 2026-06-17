import { useAdminStatusFromSession } from '@/hooks/useAdminStatus'
import { useSiweAuth } from '@/hooks/useSiweAuth'

import { VaultNavBarContent, type VaultNavBarContentProps } from './VaultNavBar'

export function VaultNavBarWithAdminStatus(
  props: Omit<VaultNavBarContentProps, 'isAdmin'>,
) {
  const siwe = useSiweAuth()
  const adminStatus = useAdminStatusFromSession({
    authAddress: typeof siwe.authAddress === 'string' ? siwe.authAddress : null,
    sessionHydrated: siwe.sessionHydrated,
  })

  return <VaultNavBarContent {...props} isAdmin={adminStatus.isAdmin} />
}
