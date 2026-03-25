import { Outlet } from 'react-router-dom'

import { PrivyClientProvider } from '@/lib/privy/client'

export default function AppPrivyShell() {
  return (
    <PrivyClientProvider>
      <Outlet />
    </PrivyClientProvider>
  )
}
