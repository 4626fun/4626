import { Outlet } from 'react-router-dom'

import AppAuthProviders from './AppAuthProviders'
import { AccessStateProvider } from './accessRuntime'

export default function AppAccessShell() {
  return (
    <AppAuthProviders>
      <AccessStateProvider>
        <Outlet />
      </AccessStateProvider>
    </AppAuthProviders>
  )
}
