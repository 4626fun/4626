import { Outlet } from 'react-router-dom'

import AppAuthProviders from './AppAuthProviders'

export default function AppAuthShell() {
  return (
    <AppAuthProviders>
      <Outlet />
    </AppAuthProviders>
  )
}
