import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import '@4626/brand-kit/styles'
import './index.css'

import { AppLoadingState } from '@/components/AppLoadingState'
import { TelegramLinkPrivyProvider } from '@/lib/privy/telegramLinkClient'
import { ThemeProvider } from '@/lib/theme'
import {
  getInitialTelegramMiniAppEntryResolution,
  resolveTelegramMiniAppEntryBootstrap,
} from '@/lib/telegramMiniAppRouteGuard'
import { TelegramLink } from '@/pages/TelegramLink'

function TelegramMiniAppUnavailable() {
  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0d1821] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Telegram Required</div>
        <h1 className="mt-3 text-xl font-semibold text-white">Open this from @akitai_bot inside Telegram.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          This account-link flow only works when Telegram Mini App context is available. Return to the bot and use the
          latest link button.
        </p>
      </div>
    </div>
  )
}

function TelegramLinkStandaloneApp() {
  const search = typeof window === 'undefined' ? '' : window.location.search
  const hasImmediateEntryContext = getInitialTelegramMiniAppEntryResolution(search) === 'ready'
  const [entryBootstrapState, setEntryBootstrapState] = useState(() => ({
    search,
    resolved: hasImmediateEntryContext,
    ready: hasImmediateEntryContext,
  }))

  useEffect(() => {
    if (hasImmediateEntryContext) return

    let cancelled = false
    void resolveTelegramMiniAppEntryBootstrap({ search }).then((ready) => {
      if (cancelled) return
      setEntryBootstrapState({ search, resolved: true, ready })
    })

    return () => {
      cancelled = true
    }
  }, [hasImmediateEntryContext, search])

  if (hasImmediateEntryContext || (entryBootstrapState.resolved && entryBootstrapState.ready)) {
    return <TelegramLink />
  }

  if (!entryBootstrapState.resolved) {
    return <AppLoadingState />
  }

  return <TelegramMiniAppUnavailable />
}

function TelegramLinkStandaloneRoot() {
  return (
    <ThemeProvider>
      <TelegramLinkPrivyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<TelegramLinkStandaloneApp />} />
          </Routes>
        </BrowserRouter>
      </TelegramLinkPrivyProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramLinkStandaloneRoot />
  </React.StrictMode>,
)
