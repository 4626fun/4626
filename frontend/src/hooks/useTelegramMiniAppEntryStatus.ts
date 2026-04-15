import { useEffect, useMemo, useState } from 'react'

import {
  getInitialTelegramMiniAppEntryResolution,
  resolveTelegramMiniAppEntryBootstrap,
} from '@/lib/telegram/telegramMiniAppRouteGuard'

type TelegramMiniAppEntryState = {
  search: string
  resolved: boolean
  ready: boolean
}

export type TelegramMiniAppEntryStatus = 'checking' | 'ready' | 'blocked'

export function useTelegramMiniAppEntryStatus(search: string): TelegramMiniAppEntryStatus {
  const hasImmediateEntryContext = useMemo(
    () => getInitialTelegramMiniAppEntryResolution(search) === 'ready',
    [search],
  )

  const [entryState, setEntryState] = useState<TelegramMiniAppEntryState>(() => ({
    search,
    resolved: hasImmediateEntryContext,
    ready: hasImmediateEntryContext,
  }))

  useEffect(() => {
    if (hasImmediateEntryContext) return

    let cancelled = false
    void resolveTelegramMiniAppEntryBootstrap({ search }).then((ready) => {
      if (cancelled) return
      setEntryState({ search, resolved: true, ready })
    })

    return () => {
      cancelled = true
    }
  }, [hasImmediateEntryContext, search])

  if (hasImmediateEntryContext) return 'ready'
  if (entryState.search !== search || !entryState.resolved) return 'checking'
  return entryState.ready ? 'ready' : 'blocked'
}
