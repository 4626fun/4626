import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AppLoadingState } from '@/components/AppLoadingState'
import {
  getInitialTelegramMiniAppEntryResolution,
  resolveTelegramMiniAppEntryBootstrap,
} from '@/lib/telegramMiniAppRouteGuard'
import { TelegramMenu } from './TelegramMenu'

export function TelegramMenuEntryRoute() {
  const location = useLocation()
  const hasImmediateEntryContext = getInitialTelegramMiniAppEntryResolution(location.search) === 'ready'
  const [entryBootstrapState, setEntryBootstrapState] = useState(() => ({
    search: location.search,
    resolved: hasImmediateEntryContext,
    ready: hasImmediateEntryContext,
  }))

  useEffect(() => {
    if (hasImmediateEntryContext) return

    let cancelled = false
    const search = location.search
    void resolveTelegramMiniAppEntryBootstrap({ search }).then((ready) => {
      if (cancelled) return
      setEntryBootstrapState({
        search,
        resolved: true,
        ready,
      })
    })

    return () => {
      cancelled = true
    }
  }, [hasImmediateEntryContext, location.search])

  if (hasImmediateEntryContext) {
    return <TelegramMenu />
  }

  if (entryBootstrapState.search !== location.search || !entryBootstrapState.resolved) {
    return <AppLoadingState />
  }

  if (entryBootstrapState.ready) {
    return <TelegramMenu />
  }

  return <Navigate to="/" replace />
}
