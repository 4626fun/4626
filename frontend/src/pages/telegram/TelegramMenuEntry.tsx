import { Navigate, useLocation } from 'react-router-dom'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { useTelegramMiniAppEntryStatus } from '@/hooks/useTelegramMiniAppEntryStatus'
import { TelegramMenu } from './TelegramMenu'

export function TelegramMenuEntryRoute() {
  const location = useLocation()
  const entryStatus = useTelegramMiniAppEntryStatus(location.search)

  if (entryStatus === 'ready') {
    return <TelegramMenu />
  }

  if (entryStatus === 'checking') {
    return <AppLoadingState />
  }

  return <Navigate to="/" replace />
}
